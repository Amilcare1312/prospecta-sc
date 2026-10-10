#!/usr/bin/env python3
"""
Carrega a base aberta de CNPJ da Receita Federal (somente Santa Catarina) no Postgres
do Prospecta SC.

Fluxo
  1. Descobre o mês mais recente no repositório da RFB (WebDAV) e baixa os .zip
     (ou usa uma pasta local com os .zip já baixados: --pasta).
  2. Lê os Estabelecimentos*.zip em streaming e mantém só UF=SC (+ filtros opcionais).
  3. Lê os Empresas*.zip e pega razão social / porte / capital dos CNPJs de SC.
  4. Faz upsert em `empresas` sem apagar o enriquecimento (Google/site) já feito.

Uso
  pip install "psycopg[binary]>=3.2" requests
  export DATABASE_URL="postgresql://usuario:senha@host/db?sslmode=require"
  python etl/carregar_cnpj_sc.py                       # baixa tudo e carrega SC (ativas, com contato)
  python etl/carregar_cnpj_sc.py --pasta ./zips        # usa zips já baixados
  python etl/carregar_cnpj_sc.py --municipios "SAO JOSE,BLUMENAU,TIMBO,INDAIAL"
  python etl/carregar_cnpj_sc.py --cnae 10,11,22,23,24,25,28,29   # só indústria de transformação (prefixos)

Observações
  - A base completa tem ~6 GB zipada. Use --apagar-zips para economizar disco.
  - Bancos gratuitos (Neon/Supabase ~0,5 GB) comportam SC filtrada por contato e/ou
    por cidades/CNAEs. SC inteira com todos os ativos passa de 1 GB.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
import time
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree

csv.field_size_limit(10_000_000)

RFB_WEBDAV = os.environ.get("RFB_WEBDAV", "https://arquivos.receitafederal.gov.br/public.php/webdav")
RFB_DAV_FILES = os.environ.get("RFB_DAV_FILES", "https://arquivos.receitafederal.gov.br/public.php/dav/files")
# Token do compartilhamento público "Dados Abertos CNPJ". Se a RFB trocar, pegue o novo em
# https://arquivos.receitafederal.gov.br/ → Dados > Cadastros > CNPJ (código após /index.php/s/)
RFB_SHARE_TOKEN = os.environ.get("RFB_SHARE_TOKEN", "YggdBLfdninEJX9")

UA = {"User-Agent": "ProspectaSC-ETL/1.0 (+dados abertos CNPJ)"}


# --------------------------------------------------------------------------- utilidades
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()


def digitos(s: str | None) -> str:
    return re.sub(r"\D", "", s or "")


def telefone(ddd: str, num: str) -> str | None:
    ddd, num = digitos(ddd), digitos(num)
    if not num:
        return None
    ddd = ddd[-2:] if len(ddd) >= 2 else ddd
    if len(num) < 8:
        return None
    return (ddd + num) if ddd else num


def whatsapp_de(tel: str | None) -> str | None:
    """Retorna 55DD9XXXXXXXX se o número parece celular (provável WhatsApp)."""
    if not tel or len(tel) < 10:
        return None
    ddd, num = tel[:2], tel[2:]
    if len(num) == 9 and num[0] == "9":
        return "55" + ddd + num
    if len(num) == 8 and num[0] in "6789":  # celular antigo, antes do 9º dígito
        return "55" + ddd + "9" + num
    return None


def data_iso(s: str) -> str | None:
    s = digitos(s)
    if len(s) != 8 or s == "00000000":
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:]}"


def capital(s: str) -> str | None:
    s = (s or "").strip()
    if not s:
        return None
    return s.replace(".", "").replace(",", ".")


def ler_zip(caminho: Path):
    """Itera as linhas (listas) do CSV dentro de um zip da RFB (latin-1, ';')."""
    with zipfile.ZipFile(caminho) as z:
        for nome in z.namelist():
            with z.open(nome) as f:
                texto = io.TextIOWrapper(f, encoding="latin-1", newline="")
                yield from csv.reader(texto, delimiter=";", quotechar='"')


# --------------------------------------------------------------------------- download
def listar_rfb():
    import requests

    def propfind(url):
        r = requests.request("PROPFIND", url, auth=(RFB_SHARE_TOKEN, ""), headers={"Depth": "1", **UA}, timeout=60)
        r.raise_for_status()
        root = ElementTree.fromstring(r.content)
        return [e.find("{DAV:}href").text for e in root.findall("{DAV:}response")]

    meses = sorted({m.group(1) for h in propfind(RFB_WEBDAV + "/") if (m := re.search(r"(\d{4}-\d{2})/?$", h))})
    if not meses:
        raise RuntimeError("Nenhum mês encontrado no repositório da RFB (token mudou?)")
    mes = meses[-1]
    arquivos = [m.group(1) for h in propfind(f"{RFB_WEBDAV}/{mes}/") if (m := re.search(r"/([^/]+\.zip)$", h, re.I))]
    return mes, arquivos


def baixar(mes: str, nome: str, pasta: Path) -> Path:
    import requests

    destino = pasta / nome
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    url = f"{RFB_DAV_FILES}/{RFB_SHARE_TOKEN}/{mes}/{nome}"
    tmp = destino.with_suffix(".part")
    for tentativa in range(5):
        try:
            with requests.get(url, stream=True, headers=UA, timeout=120) as r:
                r.raise_for_status()
                total = int(r.headers.get("content-length") or 0)
                feito = 0
                with open(tmp, "wb") as out:
                    for bloco in r.iter_content(1 << 20):
                        out.write(bloco)
                        feito += len(bloco)
                        if total:
                            print(f"\r  {nome}: {feito/total:5.1%} de {total/2**20:,.0f} MB", end="", flush=True)
            print()
            tmp.rename(destino)
            return destino
        except Exception as e:  # noqa: BLE001
            print(f"\n  falha ao baixar {nome} ({e}); tentativa {tentativa + 1}/5")
            time.sleep(10 * (tentativa + 1))
    raise RuntimeError(f"Não consegui baixar {nome}")


# --------------------------------------------------------------------------- carga
STG_ESTAB = """
create temp table stg_estab (
  cnpj text, cnpj_basico text, nome_fantasia text, matriz boolean, situacao text, data_inicio date,
  cnae_principal text, cnaes_secundarios text, tipo_logradouro text, logradouro text, numero text,
  complemento text, bairro text, cep text, municipio_codigo text, uf text,
  telefone1 text, telefone2 text, email text, whatsapp text
) on commit preserve rows"""

STG_EMP = """
create temp table stg_emp (
  cnpj_basico text primary key, razao_social text, natureza_juridica text, capital_social numeric, porte text
) on commit preserve rows"""

UPSERT = """
insert into empresas as e (
  cnpj, cnpj_basico, razao_social, nome_fantasia, matriz, situacao, data_inicio, cnae_principal,
  cnaes_secundarios, natureza_juridica, porte, capital_social, tipo_logradouro, logradouro, numero,
  complemento, bairro, cep, municipio_codigo, uf, telefone1, telefone2, email, whatsapp, ref_base)
select s.cnpj, s.cnpj_basico, m.razao_social, s.nome_fantasia, s.matriz, s.situacao, s.data_inicio,
  s.cnae_principal, s.cnaes_secundarios, m.natureza_juridica, m.porte, m.capital_social,
  s.tipo_logradouro, s.logradouro, s.numero, s.complemento, s.bairro, s.cep, s.municipio_codigo,
  s.uf, s.telefone1, s.telefone2, s.email, s.whatsapp, %(ref)s
from stg_estab s left join stg_emp m using (cnpj_basico)
on conflict (cnpj) do update set
  razao_social = excluded.razao_social, nome_fantasia = excluded.nome_fantasia, matriz = excluded.matriz,
  situacao = excluded.situacao, data_inicio = excluded.data_inicio, cnae_principal = excluded.cnae_principal,
  cnaes_secundarios = excluded.cnaes_secundarios, natureza_juridica = excluded.natureza_juridica,
  porte = excluded.porte, capital_social = excluded.capital_social, tipo_logradouro = excluded.tipo_logradouro,
  logradouro = excluded.logradouro, numero = excluded.numero, complemento = excluded.complemento,
  bairro = excluded.bairro, cep = excluded.cep, municipio_codigo = excluded.municipio_codigo, uf = excluded.uf,
  telefone1 = excluded.telefone1, telefone2 = excluded.telefone2, email = excluded.email,
  whatsapp = excluded.whatsapp, ref_base = excluded.ref_base
"""


def main():
    ap = argparse.ArgumentParser(description="Carrega empresas de SC da base CNPJ da Receita Federal")
    ap.add_argument("--pasta", default="dados-rfb", help="pasta dos .zip (baixa aqui se não existirem)")
    ap.add_argument("--sem-download", action="store_true", help="não baixa; usa só o que está na pasta")
    ap.add_argument("--uf", default="SC")
    ap.add_argument("--municipios", default="", help="nomes separados por vírgula (ex.: 'SAO JOSE,BLUMENAU')")
    ap.add_argument("--cnae", default="", help="prefixos de CNAE principal separados por vírgula (ex.: '10,25,2710')")
    ap.add_argument("--incluir-inativas", action="store_true", help="carrega também baixadas/inaptas/suspensas")
    ap.add_argument("--incluir-sem-contato", action="store_true", help="carrega também quem não tem telefone nem e-mail")
    ap.add_argument("--apagar-zips", action="store_true", help="apaga cada zip depois de processado")
    ap.add_argument("--ref", default="", help="mês de referência (AAAA-MM); detectado automaticamente no download")
    args = ap.parse_args()

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("Defina DATABASE_URL")
    import psycopg

    pasta = Path(args.pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    ref = args.ref
    mes = ""

    if not args.sem_download:
        mes, arquivos = listar_rfb()
        ref = ref or mes
        print(f"Base RFB mais recente: {mes} ({len(arquivos)} arquivos)")
        necessarios = [a for a in arquivos if re.match(r"(Estabelecimentos|Empresas)\d*\.zip|(Municipios|Cnaes)\.zip", a, re.I)]
    else:
        necessarios = [p.name for p in pasta.glob("*.zip")]

    def zips(prefixo):
        nomes = sorted(n for n in necessarios if n.lower().startswith(prefixo.lower()))
        for n in nomes:
            yield baixar(mes, n, pasta) if not args.sem_download else pasta / n

    uf = args.uf.upper()
    filtro_mun = {norm(m) for m in args.municipios.split(",") if m.strip()}
    filtro_cnae = tuple(digitos(c) for c in args.cnae.split(",") if digitos(c))

    with psycopg.connect(dsn, autocommit=False) as con:
        cur = con.cursor()
        schema = Path(__file__).resolve().parent.parent / "db" / "schema.sql"
        if schema.exists():  # garante que as tabelas existem
            cur.execute(schema.read_text(encoding="utf-8"))
            con.commit()

        # 1) Municípios e CNAEs -------------------------------------------------
        cod_municipio_ok: set[str] | None = None
        for z in zips("Municipios"):
            linhas = [(r[0].strip(), r[1].strip()) for r in ler_zip(z) if len(r) >= 2]
            cur.executemany(
                "insert into municipios (codigo, nome) values (%s, %s) on conflict (codigo) do update set nome = excluded.nome",
                linhas,
            )
            if filtro_mun:
                cod_municipio_ok = {c for c, n in linhas if norm(n) in filtro_mun}
                faltando = filtro_mun - {norm(n) for _, n in linhas}
                if faltando:
                    print("  atenção, municípios não encontrados:", ", ".join(sorted(faltando)))
            print(f"Municípios: {len(linhas)}")
            if args.apagar_zips:
                z.unlink()
        for z in zips("Cnaes"):
            linhas = [(r[0].strip(), r[1].strip()) for r in ler_zip(z) if len(r) >= 2]
            cur.executemany(
                "insert into cnaes (codigo, descricao) values (%s, %s) on conflict (codigo) do update set descricao = excluded.descricao",
                linhas,
            )
            print(f"CNAEs: {len(linhas)}")
            if args.apagar_zips:
                z.unlink()
        con.commit()

        # 2) Estabelecimentos ---------------------------------------------------
        cur.execute(STG_ESTAB)
        basicos: set[str] = set()
        municipios_vistos: set[str] = set()
        total = 0
        for z in zips("Estabelecimentos"):
            t0, n = time.time(), 0
            with cur.copy(
                "copy stg_estab (cnpj, cnpj_basico, nome_fantasia, matriz, situacao, data_inicio, cnae_principal,"
                " cnaes_secundarios, tipo_logradouro, logradouro, numero, complemento, bairro, cep, municipio_codigo,"
                " uf, telefone1, telefone2, email, whatsapp) from stdin"
            ) as cp:
                for r in ler_zip(z):
                    if len(r) < 28 or r[19] != uf:
                        continue
                    if not args.incluir_inativas and r[5] != "02":
                        continue
                    if cod_municipio_ok is not None and r[20] not in cod_municipio_ok:
                        continue
                    if filtro_cnae and not r[11].startswith(filtro_cnae):
                        continue
                    t1, t2 = telefone(r[21], r[22]), telefone(r[23], r[24])
                    email = (r[27] or "").strip().lower() or None
                    if not args.incluir_sem_contato and not (t1 or t2 or email):
                        continue
                    cnpj = r[0] + r[1] + r[2]
                    cp.write_row((
                        cnpj, r[0], (r[4] or "").strip() or None, r[3] == "1", r[5], data_iso(r[10]),
                        r[11], (r[12] or "").strip() or None, r[13].strip() or None, r[14].strip() or None,
                        r[15].strip() or None, r[16].strip() or None, r[17].strip() or None, digitos(r[18]) or None,
                        r[20], r[19], t1, t2, email, whatsapp_de(t1) or whatsapp_de(t2),
                    ))
                    basicos.add(r[0])
                    municipios_vistos.add(r[20])
                    n += 1
            total += n
            print(f"{z.name}: {n:,} estabelecimentos de {uf} ({time.time() - t0:.0f}s)")
            if args.apagar_zips:
                z.unlink()
        print(f"Total de estabelecimentos selecionados: {total:,}")

        # 3) Empresas (razão social, porte, capital) ---------------------------
        cur.execute(STG_EMP)
        for z in zips("Empresas"):
            t0, n = time.time(), 0
            with cur.copy("copy stg_emp (cnpj_basico, razao_social, natureza_juridica, capital_social, porte) from stdin") as cp:
                for r in ler_zip(z):
                    if len(r) >= 6 and r[0] in basicos:
                        cp.write_row((r[0], r[1].strip() or None, r[2] or None, capital(r[4]), r[5] or None))
                        n += 1
            print(f"{z.name}: {n:,} empresas ({time.time() - t0:.0f}s)")
            if args.apagar_zips:
                z.unlink()

        # 4) Upsert -------------------------------------------------------------
        print("Gravando em empresas…")
        cur.execute("create index on stg_estab (cnpj_basico)")
        cur.execute("analyze stg_estab")
        cur.execute(UPSERT, {"ref": ref or None})
        print(f"  {cur.rowcount:,} linhas inseridas/atualizadas")
        if municipios_vistos:
            cur.execute("update municipios set uf = %s where codigo = any(%s)", (uf, list(municipios_vistos)))
        con.commit()
    print("Concluído.")


if __name__ == "__main__":
    main()
