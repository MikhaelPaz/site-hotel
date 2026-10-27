// app/hotel.tsx
// -----------------------------------------------------------------------
// Esta é a PÁGINA PÚBLICA do site: a primeira coisa que qualquer visitante
// vê. Ela é só "visual" (apresentação) - toda a parte de lógica do
// formulário fica dentro do componente <BookingForm />, importado abaixo.
//
// A página está dividida em blocos bem definidos:
//   1. <header>  -> topo fixo com a logo e o link de acesso da equipe
//   2. <section class="photo-banner"> -> banner grande com foto de BH
//   3. bloco "reservation-heading"    -> título "Planeje sua estadia"
//   4. <div class="workspace">        -> corpo principal, dividido em:
//        - painel da esquerda: o formulário de reserva (<BookingForm />)
//        - coluna da direita: card do batalhão, horários, regras e contato
//   5. <footer> -> rodapé simples
//
// 'use client' no topo diz ao Next.js: "este componente roda no navegador
// do usuário (não é só renderizado no servidor)". Isso é necessário porque
// ele usa ícones interativos e, mais adiante, o <BookingForm /> usa estado
// (useState) e eventos de clique.
// -----------------------------------------------------------------------

'use client';

import {
  Mountain,
  Ban,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Clock3,
  Coffee,
  CarFront,
} from 'lucide-react'; // biblioteca de ícones usada em todo o site
import BookingForm from './booking-form';

export default function Hotel() {
  return (
    <>
      {/* ============================ CABEÇALHO ============================ */}
      <header className="public-header">
        <a className="brand" href="/">
          <img
            className="unit-logo"
            src="/images/logo-12-bi-mth.png"
            alt="Brasão do 12º BI Mth"
          />
          <span>
            HOTEL DE TRÂNSITO{' '}
            <span className="hotel-name">“Montanhas de Minas”</span>
            <small>12º Batalhão de Infantaria de Montanha</small>
          </span>
        </a>
        {/* Link para a área restrita da equipe (login exigido lá dentro) */}
        {/*<a className="staff" href="/equipe/login">
          Acesso da equipe <ArrowRight size={16} />
        </a>*/}
      </header>

      <main className="public-main">
        {/* ===================== BANNER COM FOTO DE BH ===================== */}
        <section className="photo-banner" aria-label="Belo Horizonte">
          <img
            src="/images/cabecalho-bh-fachada-original.png"
            alt="Composição com a fachada do batalhão e paisagens de Belo Horizonte"
          />
          {/* camada escura sobre a foto, só para o texto branco ficar legível */}
          <div className="banner-shade" />
          <div className="banner-text">
            <span className="eyebrow">BELO HORIZONTE · MINAS GERAIS</span>
            <h1>
              Seu ponto de apoio
              <br />
              na capital mineira.
            </h1>
            <p>Hotel de Trânsito do 12º BI Mth</p>
          </div>
          <span className="location-tag">
            <MapPin size={16} /> Belo Horizonte
          </span>
        </section>

        {/* =================== TÍTULO "PLANEJE SUA ESTADIA" =================== */}
        <div className="reservation-heading">
          <div>
            <span className="eyebrow">HOSPEDAGEM · CATEGORIA C</span>
            <h2>Planeje sua estadia</h2>
          </div>
          <span className="approval">
            <ShieldCheck size={18} /> Solicitações sujeitas à aprovação
          </span>
        </div>

        {/* ========================== CORPO PRINCIPAL ========================== */}
        {/* "workspace" é o container em duas colunas: formulário + informações */}
        <div className="workspace">
          {/* ---- COLUNA ESQUERDA: painel com o formulário de reserva ---- */}
          <section className="panel booking-panel">
            <div className="section-head">
              <span className="number">01</span>
              <div>
                <h2>Solicitar hospedagem</h2>
                <p>Preencha as datas e as necessidades do seu grupo.</p>
              </div>
            </div>
            {/* Todo o formulário (campos, cálculo de valor, envio) vive
                dentro deste componente - veja booking-form.tsx */}
            <BookingForm />
          </section>

          {/* ---- COLUNA DIREITA: cartão do batalhão + regras + contato ---- */}
          <aside>
            {/* Card com a foto "marca d'água" do hotel */}
            <figure className="battalion-card">
              <img
                src="/images/hotel-transito-marca-dagua.png"
                alt="Fachada do Hotel de Trânsito do 12º BI Mth"
              />
              <figcaption>
                <span className="eyebrow">12º BI Mth</span>
                <h3>Hotel de Trânsito</h3>
                <p>
                  Organização Militar responsável:
                  <br />
                  12º Batalhão de Infantaria de Montanha.
                </p>
              </figcaption>
            </figure>

            {/* Card escuro com horários de check-in/out e comodidades */}
            <section className="dark-card">
              <span className="eyebrow">INFORMAÇÕES DA ESTADIA</span>
              <div className="times">
                <div>
                  <Clock3 />
                  <small>CHECK-IN</small>
                  <strong>A partir das 14h</strong>
                </div>
                <div>
                  <Clock3 />
                  <small>CHECK-OUT</small>
                  <strong>Até as 12h</strong>
                </div>
              </div>
              <hr />
              <div className="amenity">
                <Coffee size={22} />
                <p>
                  Café da manhã incluído
                  <br />
                  <strong>Das 07h às 09h</strong>
                </p>
              </div>
              <div className="amenity">
                <CarFront size={22} />
                <p>
                  Uma vaga descoberta por reserva.
                  <br />
                  Uso obrigatório do cartão de estacionamento.
                </p>
              </div>
            </section>

            {/* Regras de pagamento e alimentação durante a estadia */}
            <section className="panel rules">
              <h3>Durante sua estadia</h3>
              <p>
                Pagamento por PagTesouro (PIX) ou GRU. Informe a escolha
                algumas horas antes da saída.
              </p>
              <p>
                A GRU deve ser paga em até 5 dias úteis após o envio. Envie
                o comprovante para o e-mail do hotel.
              </p>
              <p>
                Não oferecemos almoço, jantar ou ceia. O refeitório pode ser
                usado como apoio: 11h–14h, 17h–20h e 20h30–21h30.
              </p>
              <p>
                Refeições, lanches, bebidas e outros produtos
                disponibilizados poderão ser cobrados à parte, conforme
                valores da administração.
              </p>
            </section>

            <section className="panel rules dress-code" aria-labelledby="dress-code-title">
              <span className="eyebrow">12º BI Mth · Batalhão Lomas Valentinas</span>
              <h3 id="dress-code-title">Normas de vestimenta</h3>
              <p>Fora do ambiente do hotel, a vestimenta deverá seguir as normas do 12º Batalhão de Infantaria de Montanha.</p>
              <a className="dress-code-poster" href="/images/normas-vestimenta-12-bi-mth.png" target="_blank" rel="noreferrer" aria-label="Ampliar quadro de vestimentas proibidas">
                <img src="/images/normas-vestimenta-12-bi-mth.png" alt="Quadro de normas de vestimenta do 12º BI Mth: proibição de bermudas e shorts, chinelos, saias curtas, bonés, camisetas regatas e roupas com decote fora do ambiente do hotel." loading="lazy" />
              </a>
              <p className="fine">Clique na imagem para ampliar.</p>
            </section>
            {/* Dados de contato do hotel */}
            <section className="contact">
              <h3>Fale com o hotel</h3>
              <a href="tel:+553135089661">
                <Phone size={18} /> (31) 3508-9661
              </a>
              <a href="mailto:ht12bilmontanha@gmail.com">
                <Mail size={18} /> ht12bilmontanha@gmail.com
              </a>
              <p>
                <MapPin size={20} /> Rua Tenente Brito Melo, S/Nº
                <br />
                Barro Preto · Belo Horizonte/MG
                <br />
                CEP 30180-070
              </p>
            </section>
          </aside>
        </div>
      </main>

      {/* ============================== RODAPÉ ============================== */}
      <footer>
        Hotel de Trânsito · 12º BI Mth{' '}
        <span>Belo Horizonte · Minas Gerais</span>
      </footer>
    </>
  );
}


