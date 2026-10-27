// app/booking-form.tsx
// -----------------------------------------------------------------------
// Este arquivo contém o FORMULÁRIO DE RESERVA, usado em duas telas:
//   - na página pública (app/hotel.tsx), para qualquer visitante pedir
//     hospedagem;
//   - no painel da equipe (app/equipe/staff.tsx), com a prop `staff`
//     ativada, para a recepção registrar pedidos recebidos por e-mail.
//
// Ele também exporta dois "componentes auxiliares" reutilizáveis:
//   - <Choice />: um <select> com rótulo, usado em várias perguntas do
//     formulário (posto, finalidade, quantidade de acompanhantes...);
//   - <Check />:  uma caixinha de marcar (checkbox) com rótulo.
//
// A lógica de preço/validação NÃO fica aqui: ela vem de lib/rules.ts, e
// é chamada tanto para mostrar a estimativa em tempo real (função
// `estimate`) quanto para validar antes de enviar (função `validate`).
// -----------------------------------------------------------------------

'use client';

import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, ArrowRight, CheckCircle2 } from 'lucide-react';
import { estimate, money, ranks, today, maxArrival, validate } from '@/lib/rules';

// -------------------------------------------------------------------
// <Choice /> — um campo de seleção (dropdown) genérico e reutilizável.
// Recebe um "dicionário" de opções ({ chave: "texto exibido" }) e chama
// onChange com a CHAVE escolhida.
// `useId()` gera um id único para ligar corretamente o <label> ao
// campo (acessibilidade), mesmo que <Choice /> seja usado várias vezes
// na mesma tela.
// -------------------------------------------------------------------
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="select-field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, v]) => (
            <SelectItem value={k} key={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// -------------------------------------------------------------------
// <Check /> — uma checkbox com rótulo clicável (clicar no texto também
// marca/desmarca a caixinha, porque o texto está dentro do <label>).
// -------------------------------------------------------------------
export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="check-line">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
}

// =====================================================================
// <BookingForm /> — o formulário completo.
//
// Props:
//   staff   -> true quando é a equipe preenchendo (libera opções extras,
//              como a finalidade "comando" e a origem "E-mail");
//   onSaved -> callback opcional chamado depois que a reserva é salva
//              com sucesso (o painel da equipe usa isso para recarregar
//              a lista de reservas).
// =====================================================================
export default function BookingForm({
  staff = false,
  onSaved,
}: {
  staff?: boolean;
  onSaved?: () => void;
}) {
  // "b" (booking) guarda TODOS os dados do formulário em um único objeto.
  // Isso evita ter uma dezena de useState separados para cada campo.
  const [b, setB] = useState<any>({
    name: '',
    email: '',
    phone: '',
    start: '',
    end: '',
    rank: 'sargento',
    purpose: 'geral',
    dependents: 0,
    others: 0,
    children: 0,
    payment: 'A definir',
    eligible: false,
    source: 'Site',
    requestedBy: 'Comandante do Batalhão',
    civilArmy: false,
    couple: false,
    doubleBeds: 0,
    singleBeds: 1,
  });

  const [busy, setBusy] = useState(false); // true enquanto o envio está em andamento
  const [error, setError] = useState(''); // mensagem de erro exibida no formulário
  const [saved, setSaved] = useState(''); // protocolo da reserva, preenchido após sucesso

  // Data de "hoje" usada para limitar o campo de entrada. Fica em estado
  // (em vez de ser só uma constante) porque o formulário pode ficar
  // aberto passando da meia-noite, ou o usuário pode voltar à aba depois
  // de um tempo — nos dois casos queremos que o limite de datas se
  // atualize sozinho.
  const [accessDay, setAccessDay] = useState(today);

  useEffect(() => {
    const refresh = () => setAccessDay(today());
    // Atualiza a cada 60 segundos...
    const timer = setInterval(refresh, 60000);
    // ...e também sempre que o usuário voltar para a aba do navegador.
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // Atalho para atualizar um único campo do objeto "b" sem apagar os
  // demais (espalha o objeto anterior e sobrescreve só a chave "k").
  const set = (k: string, v: any) => setB((x: any) => ({ ...x, [k]: v }));

  // Recalcula a estimativa de preço A CADA renderização, com base nos
  // dados atuais do formulário. Como é uma conta simples, não há
  // necessidade de useMemo aqui.
  const q = estimate(b);

  // Soma "days" dias a uma data "AAAA-MM-DD" e devolve o resultado no
  // mesmo formato. Usado para calcular os limites do campo de saída
  // (ex: saída mínima = entrada + 1 dia; saída máxima = entrada + 20 dias).
  const stayDate = (start: string, days: number) =>
    new Date(Date.parse(start + 'T00:00:00Z') + days * 86400000)
      .toISOString()
      .slice(0, 10);

  // -------------------------------------------------------------------
  // Integração com assistentes de IA (ex: ChatGPT Apps): se a página
  // estiver rodando dentro de um app que expõe "document.modelContext",
  // registramos uma "ferramenta" chamada "stage_stay_dates" que permite
  // a IA preencher as datas de entrada/saída no formulário SEM enviar a
  // solicitação (o envio continua exigindo o clique humano no botão).
  // Se essa API não existir (site aberto normalmente em um navegador),
  // este efeito não faz nada.
  // -------------------------------------------------------------------
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;

    const ac = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'stage_stay_dates',
          title: 'Preencher datas da hospedagem',
          description:
            'Preenche entrada e saída no formulário, sem enviar a solicitação.',
          inputSchema: {
            type: 'object',
            properties: { start: { type: 'string' }, end: { type: 'string' } },
            required: ['start', 'end'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          // Antes de aceitar as datas sugeridas pela IA, validamos com os
          // mesmos dados "de mentira" (nome/e-mail/telefone genéricos)
          // só para conferir se as datas em si são válidas.
          execute: (v: any) => {
            validate(
              {
                ...b,
                ...v,
                name: 'Consulta',
                email: 'consulta@example.com',
                phone: '31999999999',
                eligible: true,
              },
              staff,
            );
            setB((x: any) => ({ ...x, start: v.start, end: v.end }));
            return { start: v.start, end: v.end, submitted: false };
          },
        },
        { signal: ac.signal },
      ),
    ).catch(() => {});

    return () => ac.abort();
  }, [b, staff]);

  // -------------------------------------------------------------------
  // Envio do formulário: valida no navegador (feedback rápido), depois
  // envia por POST para a API. Mesmo que a validação aqui passe, a API
  // valida TUDO DE NOVO no servidor — nunca confie só no cliente.
  // -------------------------------------------------------------------
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // evita duplo clique / envio duplicado
    setError('');
    try {
      validate(b, staff); // lança erro se algo estiver errado
      setBusy(true);
      const r = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      });
      const data: any = await r.json();
      if (!r.ok) throw Error(data.error);
      setSaved(data.id); // guarda o protocolo devolvido pela API
      onSaved?.(); // avisa o componente pai (ex: painel da equipe)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Falha ao enviar. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------
  // Tela de sucesso: depois que a reserva é salva, trocamos todo o
  // formulário por uma mensagem de confirmação com o protocolo.
  // ---------------------------------------------------------------
  if (saved) {
    return (
      <div className="success" role="status">
        <CheckCircle2 size={32} />
        <h2>Solicitação recebida</h2>
        <p>
          Sua hospedagem aguarda análise da equipe. O envio não confirma a
          reserva.
        </p>
        <p>
          Protocolo: <strong style={{ overflowWrap: 'anywhere' }}>{saved}</strong>
        </p>
        <p>Acompanhe pelo telefone ou e-mail do hotel, informando seu protocolo.</p>
        <Button
          type="button"
          onClick={() => {
            setSaved('');
            setB({ ...b, name: '', email: '', phone: '', eligible: false });
          }}
        >
          Nova solicitação
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Formulário propriamente dito.
  // ---------------------------------------------------------------
  return (
    <form onSubmit={send}>
      {/* ------------------------- Datas da estadia ------------------------- */}
      <div className="date-grid">
        <label>
          Entrada
          <input
            required
            type="date"
            min={accessDay}
            max={maxArrival(accessDay)}
            value={b.start}
            onChange={(e) => {
              const v = e.target.value;
              const day = today();
              setAccessDay(day);
              // Rejeita datas fora da janela permitida (hoje até +1 mês).
              if (v && (v < day || v > maxArrival(day))) {
                setError('Escolha uma entrada entre hoje e um mês a partir de hoje.');
                set('start', '');
                return;
              }
              setError('');
              setB((x: any) => ({
                ...x,
                start: v,
                // Se a saída já escolhida deixou de ser válida para a
                // nova entrada (saída <= entrada, ou mais de 20 dias de
                // diferença), ela é limpa para o usuário escolher de novo.
                end:
                  v && x.end && (x.end <= v || x.end > stayDate(v, 20))
                    ? ''
                    : x.end,
              }));
            }}
          />
          <small>A partir das 14h</small>
        </label>
        <label>
          Saída
          <input
            required
            type="date"
            min={b.start ? stayDate(b.start, 1) : accessDay}
            max={b.start ? stayDate(b.start, 20) : undefined}
            disabled={!b.start} // só habilita depois que a entrada é escolhida
            value={b.end}
            onChange={(e) => {
              const v = e.target.value;
              if (v && b.start && (v <= b.start || v > stayDate(b.start, 20))) {
                setError('A saída deve ocorrer entre 1 e 20 dias após a entrada.');
                set('end', '');
                return;
              }
              setError('');
              set('end', v);
            }}
          />
          <small>Até as 12h</small>
        </label>
      </div>

      <div className="notice">
        <CalendarDays size={20} />
        <span>
          Entrada em até 1 mês a partir de hoje. O quarto inteiro fica
          reservado para seu grupo.
        </span>
      </div>

      {/* ------------------------ Finalidade da estadia ------------------------ */}
      <Choice
        label="Finalidade da hospedagem"
        value={b.purpose}
        onChange={(v) =>
          setB((x: any) => ({
            ...x,
            purpose: v,
            // Ao trocar a finalidade, ajusta a configuração de camas para
            // continuar respeitando as regras de cada tipo de hospedagem
            // (veja lib/rules.ts): "saude" não permite cama de casal.
            doubleBeds: v === 'saude' ? 0 : Math.min(x.doubleBeds, 1),
            singleBeds:
              v === 'saude' ? Math.max(1, x.singleBeds) : Math.min(x.singleBeds, 2),
          }))
        }
        // A equipe (staff) tem uma opção extra: "comando" (Q01).
        options={
          staff
            ? {
                geral: 'Hospedagem geral',
                saude: 'Pacientes D Sau',
                comando: 'Pedido do Comando / Comunicação Social · Q01',
              }
            : { geral: 'Hospedagem geral', saude: 'Pacientes D Sau' }
        }
      />

      {/* Aviso legal exibido só quando a finalidade é "saude" */}
      {b.purpose === 'saude' && (
        <div className="notice dsau-note" role="note">
          <p>
            <strong>Pacientes D Sau:</strong> para beneficiário do Sistema de
            Saúde do Exército (SSEx) em tratamento de saúde próprio e/ou de
            dependente, encaminhado para atendimento em guarnição diferente
            da que reside, conforme as normas de encaminhamento do SSEx,
            terá direito à redução de 50% (cinquenta por cento) a 100% (cem
            por cento) do valor da diária, conforme parecer social da
            SAS/RM ou SAS/Gu enquadrante do MHEx. As despesas do MHEx com a
            isenção da tarifa para os hóspedes pacientes do SSEx serão
            cobertas com recursos do Sistema de Assistência Social do
            Exército (SASEx).
          </p>
        </div>
      )}

      {/* Campo extra exibido só quando a finalidade é "comando" (staff) */}
      {b.purpose === 'comando' && (
        <Choice
          label="Pedido de"
          value={b.requestedBy}
          onChange={(v) => set('requestedBy', v)}
          options={{
            'Comandante do Batalhão': 'Comandante do Batalhão',
            'Chefe da Comunicação Social': 'Chefe da Comunicação Social',
          }}
        />
      )}

      {/* ------------------------- Hóspede responsável ------------------------- */}
      <div className="form-section">
        <h3>Hóspede responsável</h3>
        <label>
          Nome completo
          <input
            required
            maxLength={160}
            autoComplete="name"
            value={b.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <div className="field-grid">
          <label>
            E-mail
            <input
              required
              type="email"
              maxLength={160}
              autoComplete="email"
              value={b.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </label>
          <label>
            Telefone
            <input
              required
              type="tel"
              maxLength={30}
              autoComplete="tel"
              value={b.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </label>
        </div>
        <Choice
          label="Posto / graduação de referência"
          value={b.rank}
          onChange={(v) => set('rank', v)}
          options={ranks}
        />
        <p className="fine">
          Casal de militares: selecione o maior posto ou graduação.
          Dependente em quarto separado: use a referência do militar
          responsável.
        </p>
        <Check
          label="Casal de militares (referência do cônjuge de maior posto/graduação)"
          checked={b.couple}
          onChange={(v) => set('couple', v)}
        />
        <Check
          label="Servidor civil do Exército: equivalência do cargo sujeita à conferência da equipe"
          checked={b.civilArmy}
          onChange={(v) => set('civilArmy', v)}
        />
      </div>

      {/* --------------------------- Acompanhantes --------------------------- */}
      <div className="form-section">
        <h3>Acompanhantes</h3>
        <p className="fine">
          Além do responsável. Crianças isentas também contam para a
          capacidade. Máximo: 3 pessoas.
        </p>
        <div className="field-grid">
          {/* Gera três <Choice /> a partir de uma lista, para não repetir
              o mesmo JSX três vezes (um por tipo de acompanhante). */}
          {(
            [
              ['dependents', 'Dependentes com 7 anos ou mais (+25%)'],
              ['others', 'Sem vínculo de dependência (+50%)'],
              ['children', 'Crianças até 6 anos com pais/responsável (isentas)'],
            ] as const
          ).map(([k, label]) => (
            <Choice
              key={k}
              label={label}
              value={String(b[k])}
              options={{ '0': 'Nenhum', '1': '1 hóspede', '2': '2 hóspedes' }}
              onChange={(v) => set(k, Number(v))}
            />
          ))}
        </div>
      </div>

      {/* ------------------------------- Camas ------------------------------- */}
      <div className="form-section">
        <h3>Quais camas você precisa?</h3>
        <p className="fine">
          Informe a configuração desejada para o grupo. A equipe confirmará
          a possibilidade de atendimento antes de aprovar a reserva.
        </p>
        <div className="field-grid">
          {/* Hospedagem de saúde não usa cama de casal (regra do hotel) */}
          {b.purpose !== 'saude' && (
            <Choice
              label="Camas de casal"
              value={String(b.doubleBeds)}
              options={{ '0': 'Nenhuma', '1': '1 cama' }}
              onChange={(v) => set('doubleBeds', Number(v))}
            />
          )}
          <Choice
            label="Camas de solteiro"
            value={String(b.singleBeds)}
            options={
              b.purpose === 'saude'
                ? { '1': '1 cama', '2': '2 camas', '3': '3 camas' }
                : { '0': 'Nenhuma', '1': '1 cama', '2': '2 camas' }
            }
            onChange={(v) => set('singleBeds', Number(v))}
          />
        </div>
      </div>

      {/* --------------------------- Forma de pagamento --------------------------- */}
      <div className="form-section">
        <Choice
          label="Forma de pagamento pretendida"
          value={b.payment}
          options={{
            'A definir': 'A definir antes da saída',
            PIX: 'PagTesouro (PIX)',
            GRU: 'GRU',
          }}
          onChange={(v) => set('payment', v)}
        />
        {/* Campo visível só para a equipe, para registrar pedidos vindos
            por e-mail em vez de recebidos pelo site. */}
        {staff && (
          <Choice
            label="Origem da solicitação"
            value={b.source}
            options={{ Site: 'Site / recepção', 'E-mail': 'E-mail' }}
            onChange={(v) => set('source', v)}
          />
        )}
      </div>

      {/* ------------------------- Estimativa de preço ------------------------- */}
      <div className="quote">
        <span>Estimativa de hospedagem</span>
        <br />
        <strong>
          {/* Se já houver datas válidas (nights > 0), mostra o total da
              estadia; senão, mostra o valor "por diária" como referência. */}
          {Number.isFinite(q.total) && q.nights > 0
            ? money(q.total)
            : money(q.daily) + ' / diária'}
        </strong>
        <p>
          {money(q.base)} de referência + acréscimos por acompanhantes
          {q.nights > 0 ? ' · ' + q.nights + ' diária(s)' : ''}.
        </p>
        <small>
          Café da manhã incluído. Consumos extras não incluídos. Tarifa
          sujeita à conferência da equipe.
          {b.purpose === 'saude'
            ? ' Redução de 50% a 100% somente após análise do parecer social. Não envie informações clínicas neste formulário.'
            : ''}
        </small>
      </div>

      {/* ----------------------- Confirmação e envio ----------------------- */}
      <Check
        label="Confirmo que o grupo se enquadra no público atendido e que li as regras de hospedagem."
        checked={b.eligible}
        onChange={(v) => set('eligible', v)}
      />
      <p className="fine">
        Destinado a oficiais, subtenentes e sargentos das Forças Armadas,
        Auxiliares e de Nações Amigas e seus dependentes. Os dados de
        contato serão utilizados pela equipe para tratar a solicitação.
      </p>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !b.eligible} className="primary">
        {busy ? 'Enviando…' : 'Enviar solicitação'} <ArrowRight size={18} />
      </Button>
    </form>
  );
}
