import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import './vendas.css';


export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Prospecta SC — Encontre clientes B2B em Santa Catarina',
  description: 'Empresas de SC com telefone, WhatsApp e e-mail, filtradas por cidade e ramo, com CRM pronto. Teste 7 dias grátis.',
  openGraph: {
    title: 'Prospecta SC — Encontre clientes B2B em Santa Catarina',
    description: 'Filtre por cidade e ramo, receba os contatos e venda pelo CRM com WhatsApp em um clique.',
    type: 'website',
    locale: 'pt_BR',
  },
};

async function totalEmpresas(): Promise<number | null> {
  try {
    const [r] = await db()`select count(*)::int as n from empresas`;
    return (r?.n as number) || null;
  } catch {
    return null;
  }
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: n % 1 ? 2 : 0 });
const Check = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17704a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
);

const RECURSOS = [
  ['Filtro por cidade', 'Marque uma ou várias cidades de SC, com a quantidade de empresas de cada uma.'],
  ['Filtro por ramo', 'Digite o termo e o sistema seleciona todas as atividades (CNAE) relacionadas.'],
  ['Telefone e WhatsApp', 'Celulares identificados viram link de WhatsApp com sua mensagem já escrita.'],
  ['E-mail que funciona', 'Alerta quando o e-mail cadastrado é do contador e busca o e-mail comercial no site.'],
  ['Google Maps', 'Busque por segmento no Maps e complete com telefone atual, site e avaliações.'],
  ['CRM em funil', 'Arraste os leads entre as etapas, com valor, próximo contato e histórico.'],
  ['Exportar planilha', 'Baixe qualquer lista em CSV, pronta para abrir no Excel.'],
  ['No celular', 'Acesse pelo navegador, sem instalar nada, no computador ou no telefone.'],
];
const PUBLICOS = ['Representantes comerciais', 'Energia solar', 'Serviços industriais', 'Contabilidade', 'Software B2B', 'Distribuidores e atacado', 'Seguros e benefícios', 'Agências de marketing'];
const INCLUSO = ['Base completa de empresas ativas', 'Filtros por cidade, ramo, porte e capital social', 'CRM com funil e histórico de contatos', 'WhatsApp, e-mail e ligação em um clique', 'Atualização mensal da base da Receita'];
const FAQ = [
  ['De onde vêm os dados?', 'Da base pública e oficial do CNPJ, publicada pela Receita Federal e atualizada mensalmente. O Google Maps e o site da empresa complementam os contatos.'],
  ['Isso está de acordo com a LGPD?', 'Os dados são públicos e de pessoas jurídicas. Para prospecção B2B, aborde com assunto ligado ao negócio da empresa e respeite quem pedir para não ser contatado. O CRM tem a marcação “Não contatar”.'],
  ['Todo número tem WhatsApp?', 'Não. O sistema identifica os números de celular, que costumam ter WhatsApp, e marca como provável. Telefones fixos continuam disponíveis para ligação.'],
  ['Preciso instalar alguma coisa?', 'Não. Funciona no navegador do computador e do celular. Você cria a conta e já começa a usar.'],
  ['Como pago?', 'Por PIX, boleto ou cartão, direto na plataforma. O acesso é liberado automaticamente assim que o pagamento é confirmado.'],
  ['Posso cancelar quando quiser?', 'Sim. Não há fidelidade: você cancela a renovação na tela Assinatura e continua usando até o fim do período pago.'],
];

export default async function Vendas() {
  const total = await totalEmpresas();
  const mensal = Number(String(process.env.PRECO_MENSAL || '').replace(',', '.')) || null;
  const anual = Number(String(process.env.PRECO_ANUAL || '').replace(',', '.')) || null;
  const dias = Number(process.env.TESTE_DIAS ?? 7) || 7;
  const wa = process.env.SUPORTE_WHATSAPP
    ? `https://wa.me/${process.env.SUPORTE_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Vi a página do Prospecta SC e tenho uma dúvida.')}`
    : null;
  const totalTxt = total ? (total >= 1000 ? `${Math.floor(total / 1000).toLocaleString('pt-BR')} mil+` : String(total)) : null;

  return (
    <div className="lp">
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" />
      <div className="navy">
        <header className="top">
          <div className="marca d">
            <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b1a2e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg></span>
            Prospecta SC
          </div>
          <nav className="top-links">
            <Link className="entrar" href="/login">Entrar</Link>
            <Link className="cta am peq" href="/cadastro">Testar grátis</Link>
          </nav>
        </header>

        <section className="hero">
          <div>
            <div className="selo"><i />Base oficial da Receita Federal · atualizada todo mês</div>
            <h1 className="d">Encontre empresas de Santa Catarina com telefone, WhatsApp e e-mail — e transforme em clientes.</h1>
            <p className="sub">Escolha a cidade e o ramo de atividade, receba a lista na hora e trabalhe cada contato num CRM pronto, com WhatsApp em um clique.</p>
            <div className="botoes">
              <Link className="cta am" href="/cadastro">Quero testar {dias} dias grátis</Link>
              <a className="cta lin" href="#como-funciona">Ver como funciona</a>
            </div>
            <div className="nums">
              {totalTxt && <div><b className="d">{totalTxt}</b><small>empresas ativas na base</small></div>}
              <div><b className="d">295</b><small>municípios catarinenses</small></div>
              <div><b className="d">1.300+</b><small>atividades (CNAE) para filtrar</small></div>
            </div>
          </div>
          <div className="mock" role="img" aria-label="Ilustração da tela de busca do Prospecta SC">
            <div className="chips">
              <span className="chip c-az">Blumenau</span><span className="chip c-az">Brusque</span>
              <span className="chip c-am">Indústria têxtil</span><span className="chip c-vd">Com WhatsApp</span>
            </div>
            <div className="mock-top"><span><b>Empresas</b> encontradas</span><span>+ Adicionar ao CRM</span></div>
            {[['Indústria Exemplo Ltda', 'Blumenau · Tecelagem · EPP'], ['Confecções Modelo S.A.', 'Brusque · Confecção · Médio porte'], ['Fiação Ilustrativa ME', 'Brusque · Fiação · ME'], ['Têxtil Demonstração Ltda', 'Blumenau · Acabamento · EPP']].map(([n, i]) => (
              <div className="linha" key={n}>
                <span className="cx" />
                <div><b>{n}</b><small>{i}</small></div>
                <div className="tags"><span className="c-vd">WhatsApp</span><span className="c-az">E-mail</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="sec">
        <div className="wrap">
          <p className="kicker">O problema</p>
          <h2 className="d">Prospectar no braço consome o tempo que você deveria usar vendendo.</h2>
          <div className="g3">
            <div className="cartao"><h3 className="d">Listas compradas e velhas</h3><p>Telefones que não existem mais, empresas fechadas e nenhuma forma de saber de onde os dados vieram.</p></div>
            <div className="cartao"><h3 className="d">Horas garimpando no Google</h3><p>Abrir site por site, copiar telefone, colar na planilha. Uma tarde inteira para juntar trinta contatos.</p></div>
            <div className="cartao"><h3 className="d">Lead que esfria na planilha</h3><p>Sem lembrete e sem histórico, o retorno combinado fica para depois e o cliente fecha com outro.</p></div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="sec branco">
        <div className="wrap">
          <p className="kicker">Como funciona</p>
          <h2 className="d">Da busca ao primeiro WhatsApp em menos de 5 minutos.</h2>
          <div className="g3">
            <div className="passo"><div className="n d">1</div><h3 className="d">Filtre quem você quer atender</h3><p>Marque as cidades, digite o ramo (“têxtil”, “supermercado”, “metalúrgica”) e refine por porte, capital social e data de abertura.</p></div>
            <div className="passo"><div className="n d">2</div><h3 className="d">Receba os contatos na hora</h3><p>Telefone, WhatsApp provável, e-mail e endereço completo. Complete com dados do Google Maps e do site da empresa em um clique.</p></div>
            <div className="passo"><div className="n d">3</div><h3 className="d">Venda pelo CRM</h3><p>Mande para o funil, chame no WhatsApp com sua mensagem pronta, agende o retorno e acompanhe até fechar.</p></div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <p className="kicker">Tudo o que vem incluso</p>
          <h2 className="d">Uma ferramenta só, do primeiro contato ao contrato.</h2>
          <div className="g4">
            {RECURSOS.map(([t, d]) => <div className="cartao" key={t}><h3 className="d">{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="sec navy">
        <div className="wrap">
          <p className="kicker" style={{ color: '#f2a81d' }}>Para quem é</p>
          <h2 className="d" style={{ color: '#fff' }}>Para quem vende para empresas em Santa Catarina.</h2>
          <div className="publicos">{PUBLICOS.map((p) => <span key={p}>{p}</span>)}</div>
        </div>
      </section>

      <section id="planos" className="sec">
        <div className="wrap">
          <p className="kicker" style={{ textAlign: 'center' }}>Planos</p>
          <h2 className="d" style={{ textAlign: 'center', margin: '0 auto 40px' }}>Um cliente novo paga o ano inteiro.</h2>
          <div className="planos">
            {[['Mensal', mensal, '/mês', false], ['Anual', anual, '/ano', true]].filter(([, v]) => v).map(([nome, valor, suf, dest]) => (
              <div className={`plano ${dest ? 'dest' : ''}`} key={nome as string}>
                <div className="d" style={{ fontWeight: 700, fontSize: 22 }}>Plano {nome as string}</div>
                <div className="preco"><b className="d">{brl(valor as number)}</b><span style={{ color: '#4a5568', fontSize: 18 }}>{suf as string}</span></div>
                {dest && mensal && <div style={{ color: '#17704a', fontWeight: 600 }}>Economize {brl(mensal * 12 - (valor as number))} por ano</div>}
                <ul className="lista">{INCLUSO.map((i) => <li key={i}><Check />{i}</li>)}</ul>
                <Link className={`cta ${dest ? 'nv' : 'am'}`} href="/cadastro">Começar teste grátis</Link>
              </div>
            ))}
            {!mensal && !anual && (
              <div className="plano dest">
                <ul className="lista">{INCLUSO.map((i) => <li key={i}><Check />{i}</li>)}</ul>
                <Link className="cta am" href="/cadastro">Começar teste grátis</Link>
              </div>
            )}
          </div>
          <p style={{ textAlign: 'center', color: '#4a5568', fontSize: 15, marginTop: 20 }}>{dias} dias grátis, sem cartão. Depois, PIX, boleto ou cartão. Sem fidelidade.</p>
        </div>
      </section>

      <section className="sec branco">
        <div className="wrap faq">
          <h2 className="d" style={{ marginBottom: 24 }}>Perguntas frequentes</h2>
          {FAQ.map(([p, r]) => <div key={p}><b>{p}</b><p>{r}</p></div>)}
        </div>
      </section>

      <section className="sec final">
        <div className="wrap">
          <h2 className="d">Sua próxima lista de clientes já está pronta.</h2>
          <p>Teste {dias} dias e veja quantas empresas do seu ramo existem na sua região.</p>
          <div className="botoes" style={{ justifyContent: 'center' }}>
            <Link className="cta nv" href="/cadastro">Criar minha conta grátis</Link>
            {wa && <a className="cta lin-escura" href={wa} target="_blank" rel="noreferrer">Tirar dúvidas no WhatsApp</a>}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <span>© Prospecta SC{process.env.EMPRESA_RODAPE ? ` · ${process.env.EMPRESA_RODAPE}` : ''}</span>
          <span>Dados públicos do CNPJ (Receita Federal). Uso conforme a LGPD.</span>
        </div>
      </footer>
    </div>
  );
}
