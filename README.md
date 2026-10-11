# Prospecta SC

Micro SaaS de prospecção B2B para Santa Catarina. Junta duas fontes e entrega os contatos num CRM simples:

| Fonte | O que traz | Custo |
|---|---|---|
| **Base CNPJ da Receita Federal** (dados abertos, mensal) | razão social, nome fantasia, CNAE, porte, capital social, endereço completo, até 2 telefones, e-mail cadastrado | gratuita |
| **Google Maps (Places API New)** | telefone atual, site, nota e avaliações, link do Maps | pago por uso (Google Cloud) |
| **Site da empresa** (lido automaticamente) | e-mails do próprio domínio e link de WhatsApp | — |

## Telas

- **Prospectar** — filtra a base CNPJ por cidade, CNAE (com atalhos: indústria, supermercados, hotéis, hospitais, condomínios, frigoríficos, postos), porte, capital social, data de abertura e "tem telefone / WhatsApp / e-mail / site". Seleciona e manda para o CRM, enriquece com o Google ou exporta CSV (abre direto no Excel).
- **Google Maps** — busca por segmento + cidade ("metalúrgica" em "Blumenau"), cruza o telefone com a base CNPJ para achar o CNPJ e adiciona ao CRM (opcionalmente lendo o site atrás de e-mail).
- **CRM** — funil kanban (Novo → Contatado → Qualificado → Proposta → Negociação → Ganho/Perdido) com arrastar e soltar, valor estimado, próximo contato, responsável, histórico, botão de WhatsApp com mensagem padrão personalizável (`{nome}`, `{cidade}`), e-mail e ligação (cada clique fica registrado), marcação "não contatar" e exportação CSV.

## Sobre os contatos (importante)

- **WhatsApp é inferido**: quando o telefone é celular (9 dígitos começando com 9, ou celular antigo de 8 dígitos), o sistema gera o link `wa.me`. Não há como confirmar que o número tem WhatsApp sem enviar mensagem.
- **E-mail da Receita**: muitas empresas cadastram o e-mail do escritório de contabilidade. O sistema marca esses casos como "contador?" e existe o filtro "Ignorar e-mail de contador". O enriquecimento pelo site costuma achar o e-mail comercial correto.
- O CRM, ao criar o lead, prioriza: e-mail não-contador da Receita → e-mail do site → e-mail da Receita.

## Arquitetura

```
Next.js 15 (App Router) na Vercel ── Postgres (Neon/Supabase)
        │                                   ▲
        ├─ /api/google/buscar ── Places API │
        ├─ /api/enriquecer ───── Places + site da empresa
        └─ CRM (/api/leads)                 │
                                            │
etl/carregar_cnpj_sc.py (rodar local ou GitHub Actions, mensal)
  └─ baixa a base da Receita (≈6 GB zip), filtra SC e faz upsert
```

O ETL **não roda na Vercel** (o volume é grande demais para funções serverless). Rode no seu computador ou deixe o GitHub Actions fazer isso todo mês (`.github/workflows/atualizar-base.yml`).

## Passo a passo

### 1. Banco de dados

Na Vercel: **Storage → Marketplace → Neon (Postgres)** e conecte ao projeto — a variável `DATABASE_URL` é criada sozinha. (Supabase ou qualquer Postgres 14+ também serve.)

Aplique o schema:

```bash
npm install
DATABASE_URL="postgresql://..." npm run db:schema
```

### 2. Carregar a base da Receita (SC)

```bash
pip install "psycopg[binary]>=3.2" requests
export DATABASE_URL="postgresql://..."

# SC inteira: ativas e com algum contato (recomendado ter ≥ 1 GB de banco)
python etl/carregar_cnpj_sc.py --apagar-zips

# Banco gratuito (~0,5 GB)? Limite por cidades e/ou CNAE:
python etl/carregar_cnpj_sc.py --apagar-zips \
  --municipios "SAO JOSE,FLORIANOPOLIS,PALHOCA,BIGUACU,BLUMENAU,TIMBO,INDAIAL,JOINVILLE" \
  --cnae 10,11,13,14,15,16,17,20,22,23,24,25,27,28,29,31,4711,5510,8610,8112
```

Opções úteis: `--pasta` (onde ficam os zips), `--sem-download` (usa zips já baixados), `--incluir-inativas`, `--incluir-sem-contato`.
O download leva de 20 min a 1 h; o processamento de SC, outros ~20–40 min. Pode rodar de novo todo mês: o upsert **preserva** o enriquecimento e não mexe no CRM.

> Se a Receita mudar o endereço de download (aconteceu em jan/2026), pegue o novo código do compartilhamento em `https://arquivos.receitafederal.gov.br/` (pasta Dados › Cadastros › CNPJ, é o código depois de `/index.php/s/`) e rode com `RFB_SHARE_TOKEN=novo_codigo`.

### 3. Chave do Google (opcional, mas recomendada)

No Google Cloud Console: crie um projeto, ative **Places API (New)**, crie uma chave de API e restrinja-a a essa API. Coloque em `GOOGLE_PLACES_API_KEY`. Cada busca/enriquecimento consome uma requisição de *Text Search*; confira os preços e a cota gratuita atual na página de preços da Google Maps Platform e configure um orçamento/alerta no faturamento.

### 4. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Postgres (URL *pooled* no Neon) |
| `APP_PASSWORD` | senha de acesso ao sistema |
| `AUTH_SECRET` | texto aleatório longo (assina o cookie de sessão) |
| `GOOGLE_PLACES_API_KEY` | chave da Places API (New) |
| `NEXT_PUBLIC_APP_NOME` | opcional — nome exibido no topo |

### 5. Deploy

Suba a pasta para um repositório no GitHub e importe na Vercel (framework detectado: Next.js). Ou, local:

```bash
cp .env.example .env.local   # preencha
npm run dev                  # http://localhost:3000
```

### 6. Atualização mensal automática

No GitHub: **Settings → Secrets → Actions → `DATABASE_URL`**. Opcional em **Variables**: `ETL_MUNICIPIOS` e `ETL_CNAE` com os mesmos filtros do passo 2. O workflow roda todo dia 20 (e pode ser disparado manualmente em *Actions*).

## Contas de clientes (venda como assinatura)

- Cada cliente cria a conta em **/cadastro** e ganha **TESTE_DIAS** (padrão 7) de teste. O CRM de cada conta é separado.
- O administrador entra com e-mail **admin** (ou `ADMIN_EMAIL`) e a senha `APP_PASSWORD`, e vê a tela **Clientes**: liberar +7/+30 dias ou +1 ano, trocar plano, bloquear e limitar estados (ex.: `SC,PR`).
- Conta vencida continua vendo a tela, mas não consulta nada até ser renovada; os leads ficam guardados.
- Consultas ao Google têm limite mensal por conta (`GOOGLE_LIMITE_MENSAL`). Empresas enriquecidas nos últimos 90 dias são reaproveitadas sem novo custo.
- Mais estados na base: variável `ETL_UFS` no GitHub (ex.: `SC,PR,RS` ou `BR`) e `ETL_MUNICIPIOS=*` para todas as cidades. Atenção ao tamanho do banco.
- O banco é migrado automaticamente na primeira requisição depois do deploy.

## LGPD — boas práticas

Os dados vêm de bases públicas e são de pessoas jurídicas, mas e-mails/telefones podem identificar pessoas (MEIs, sócios). Para prospecção B2B com base no legítimo interesse:

- aborde com assunto ligado à atividade da empresa e identifique-se;
- ofereça saída em toda mensagem e, ao receber pedido, marque **"Não contatar"** no lead;
- não compre/venda as listas e não use para disparo em massa sem consentimento (o WhatsApp também bloqueia números que fazem isso).

## Estrutura

```
app/(app)/            telas: Prospectar (/), Google Maps (/google), CRM (/crm)
app/api/              rotas: empresas, enriquecer, google/buscar, leads, cnaes, meta, login
components/           UI (Prospectar, GoogleBusca, Crm)
lib/                  banco, filtros SQL, Google Places, leitura de sites, utilidades de contato
db/schema.sql         tabelas: municipios, cnaes, empresas, leads, atividades
etl/                  carregador da base CNPJ (Python)
```
