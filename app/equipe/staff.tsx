// app/equipe/staff.tsx
// -----------------------------------------------------------------------
// O PAINEL ADMINISTRATIVO usado pela equipe do hotel. É o coração da
// gestão de reservas: aqui a equipe aprova/recusa pedidos, registra
// check-in/check-out, acompanha a ocupação dos quartos e cadastra
// pedidos recebidos por e-mail.
//
// Estrutura do arquivo, de cima para baixo:
//   - Confirm    -> pequeno diálogo de confirmação ("tem certeza?")
//   - Booking    -> o card de UMA reserva, com os botões de ação
//   - Staff      -> componente principal: busca as reservas e organiza
//                   tudo em abas (Reservas / Ocupação / Registrar pedido)
// -----------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';
import CalendarMirror from './calendar-mirror';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import BookingForm, { Choice, Check } from '../booking-form';
import { money, ranks, today } from '@/lib/rules';
import { useRouter } from "next/navigation";
import Planilhas from './planilhas';
import Hospedes from './hospedes';
import ControleOrcamentario from './controle-orcamentario';
import type { Guest } from '@/lib/guests';

import { ShieldCheck, Mountain, Plus, RefreshCw, CalendarDays, FileSpreadsheet, Wallet, Users, Table2 } from 'lucide-react';

// Converte "AAAA-MM-DD" para "DD/MM/AAAA", só para exibição.
const date = (s: string) => s.split('-').reverse().join('/');

// -------------------------------------------------------------------
// <Confirm /> — botão que, ao ser clicado, abre um diálogo de
// confirmação antes de executar a ação `run` (usado para ações que não
// podem ser desfeitas facilmente, como recusar ou cancelar uma reserva).
// -------------------------------------------------------------------
function Confirm({ label, run }: { label: string; run: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação encerra a reserva ou solicitação. Confira os dados antes
            de continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={run}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// "2026-10" -> "Outubro de 2026"
const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] + ' de ' + ym.slice(0, 4);



// =====================================================================
// <Booking /> — card com os detalhes de UMA reserva e os controles de
// ação disponíveis para a situação (status) atual dela.
//   b       -> os dados da reserva (linha do banco, já com "data" no
//              formato de objeto, não mais string JSON)
//   refresh -> função para recarregar a lista após uma ação bem-sucedida
// =====================================================================
function Booking({ b, refresh }: { b: any; refresh: () => void }) {
  // Estados locais dos campos que a equipe pode preencher/editar antes
  // de confirmar uma ação (quarto, tarifa, desconto, consumo, pagamento).
  const [room, setRoom] = useState(
    b.room || (b.purpose === 'saude' ? 'Q04' : b.purpose === 'comando' ? 'Q01' : 'Q02'),
  );
  const [rank, setRank] = useState(b.data.rank);
  const [discount, setDiscount] = useState('0');
  const [reference, setReference] = useState('');
  const [consumption, setConsumption] = useState(String(b.data.consumption || 0));
  const [payment, setPayment] = useState(
    b.data.payment === 'A definir' ? 'PIX' : b.data.payment,
  );
  const [paid, setPaid] = useState(b.data.paid === true);
  // Controle orçamentário: valor pago e número de referência (GRU/PIX),
  // informados no check-out. Enquanto a equipe não digitar um valor, o
  // campo mostra o sugerido (diárias com desconto + consumos extras).
  const [paidAmount, setPaidAmount] = useState<string | null>(
    b.data.paidAmount == null ? null : String(b.data.paidAmount),
  );
  const [paymentReference, setPaymentReference] = useState(b.data.paymentReference || '');
  const suggested =
    b.data.quote.total * (1 - (b.data.discount || 0) / 100) + (Number(consumption) || 0);
  const amountShown = paidAmount ?? suggested.toFixed(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [month, setMonth] = useState('Todos'); // 'Todos' ou 'AAAA-MM'

  // Envia a alteração de situação (e os campos relacionados) para a API
  // via PATCH. É chamada por todos os botões de ação deste card.
  async function update(status: string) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/reservas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: b.id,
          status,
          room,
          rank,
          discount: Number(discount),
          discountReference: reference,
          consumption: Number(consumption),
          payment,
          paid,
          paidAmount: amountShown,
          paymentReference,
        }),
      });
      const v: any = await r.json();
      if (!r.ok) throw Error(v.error);
      refresh(); // recarrega a lista para refletir a mudança
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
  setBusy(true);
  setError('');
  try {
    const r = await fetch('/api/reservas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id }),
    });
    const v: any = await r.json();
    if (!r.ok) throw Error(v.error);
    refresh();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Falha ao excluir.');
  } finally {
    setBusy(false);
  }
}

  const d = b.data; // atalho para os detalhes extras da reserva
  // Reserva fechada: concluída e com pagamento conferido pela equipe.
  const closed = b.status === 'Concluída' && b.data.paid === true;

  return (
    <article className="record">
      {/* ------------------------- Cabeçalho do card ------------------------- */}
      <div className="record-top">
        <div>
          <h3 style={{ margin: 0 }}>{b.name}</h3>
          <p>
            {date(b.start)} → {date(b.end)} · {d.quote.nights} diária(s) ·{' '}
            {1 + d.dependents + d.others + d.children} pessoa(s)
          </p>
        </div>
        <span className="tag">{b.status}</span>
      </div>

      {/* ------------------------- Resumo da reserva ------------------------- */}
      <p>
        <strong>{b.room || 'Quarto a definir'}</strong> ·{' '}
        {b.purpose === 'saude'
          ? 'D Sau'
          : b.purpose === 'comando'
            ? 'Pedido: ' + d.requestedBy
            : 'Hospedagem geral'}{' '}
        · Origem: {d.source}
      </p>
      <p>
        <a href={'mailto:' + b.email}>{b.email}</a> ·{' '}
        <a href={'tel:' + b.phone}>{b.phone}</a>
      </p>
      <p>
        {ranks[d.rank]} · {money(d.quote.total * (1 - d.discount / 100) + d.consumption)}
        {d.discount > 0 ? ' · Redução: ' + d.discount + '%' : ''} · {d.payment}
        {d.paid ? ' · Pagamento registrado' : ' · Pagamento não registrado'}
      </p>

      {/* Avisos condicionais que chamam a atenção da equipe antes de aprovar */}
      {d.civilArmy && (
        <p className="notice">
          Servidor civil do Exército: conferir equivalência do cargo antes de
          aprovar.
        </p>
      )}
      {d.couple && (
        <p className="fine">
          Casal de militares: conferir referência do cônjuge de maior
          posto/graduação.
        </p>
      )}
      <p className="notice">
        Camas solicitadas: {d.doubleBeds ?? 'Não informado'} de casal e{' '}
        {d.singleBeds ?? 'Não informado'} de solteiro. Confira o atendimento
        antes de aprovar.
      </p>
      <p className="fine">
        {d.dependents} dependente(s) pagante(s), {d.others} adicional(is) sem
        dependência, {d.children} criança(s) isenta(s). Protocolo: {b.id}
      </p>
      {d.discountReference && (
        <p className="fine">Referência do parecer: {d.discountReference}</p>
      )}

      {/* ==================== Ações disponíveis por situação ==================== */}

      {/* Reserva ainda "Pendente": a equipe escolhe o quarto e a tarifa,
          eventualmente aplica desconto (saúde), e aprova ou recusa. */}
      {b.status === 'Pendente' && (
        <div className="form-section">
          <CalendarMirror start={b.start} end={b.end} />
          <div className="field-grid">
            <Choice
              label="Quarto para aprovação"
              value={room}
              onChange={setRoom}
              options={
                b.purpose === 'saude'
                ? { Q04: 'Q04 · Saúde' }
                : b.purpose === 'comando'
                  ? { Q01: 'Q01 · Comando / Comunicação Social', Q02: 'Q02', Q03: 'Q03', Q04: 'Q04 · Saúde' }
                  : { Q01: 'Q01', Q02: 'Q02', Q03: 'Q03', Q04: 'Q04' }
              }
            />
            <Choice
              label="Tarifa conferida pela equipe"
              value={rank}
              onChange={setRank}
              options={ranks}
            />
          </div>

          {/* Campos de desconto, exibidos só para hospedagem de saúde */}
          {b.purpose === 'saude' && (
            <>
              <div className="field-grid">
                <label>
                  Redução conforme parecer (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </label>
                <label>
                  Referência do parecer social
                  <input
                    maxLength={120}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Número / referência, sem dados clínicos"
                  />
                </label>
              </div>
              <p className="fine">
                Use 0 sem redução, ou 50 a 100 conforme parecer. Confira a
                abrangência do benefício ao grupo antes de aprovar.
              </p>
            </>
          )}

          <div className="actions">
            <Button disabled={busy} onClick={() => update('Aprovada')}>
              Aprovar reserva
            </Button>
            <Confirm label="Recusar solicitação" run={() => update('Recusada')} />
          </div>
        </div>
      )}

      {/* Reserva "Aprovada": só falta registrar o check-in (ou cancelar). */}
      {b.status === 'Aprovada' && (
        <div className="actions">
          <Button disabled={busy} onClick={() => update('Hospedado')}>
            Registrar check-in
          </Button>
          <Confirm label="Cancelar reserva" run={() => update('Cancelada')} />
        </div>
      )}

      {/* Hóspede "Hospedado" ou reserva já "Concluída": tela de
          consumo/pagamento, usada para fechar a conta no check-out
          (e também para corrigir os valores depois, se necessário). */}
      {(b.status === 'Hospedado' || b.status === 'Concluída') && (
  <>
    <div className="field-grid">
      <label>
        Consumos extras (R$)
        <input
          type="number"
          min="0"
          step="0.01"
          value={consumption}
          disabled={closed}
          onChange={(e) => setConsumption(e.target.value)}
        />
      </label>
      <Choice
        label="Pagamento"
        value={payment}
        options={{ PIX: 'PagTesouro (PIX)', GRU: 'GRU' }}
        onChange={setPayment}
      />
    </div>
    <div className="field-grid">
      <label>
        Valor pago (R$)
        <input
          type="number"
          min="0"
          step="0.01"
          value={amountShown}
          disabled={closed}
          onChange={(e) => setPaidAmount(e.target.value)}
        />
      </label>
      <label>
        Número de referência
        <input
          type="text"
          maxLength={60}
          value={paymentReference}
          disabled={closed}
          placeholder="Ex.: nº da GRU ou do PIX (opcional)"
          onChange={(e) => setPaymentReference(e.target.value)}
        />
      </label>
    </div>
    <p className="fine">
      O valor pago e o número de referência aparecem na aba Controle orçamentário.
    </p>
    {!closed && (
      <>
        <Check
          label="Pagamento conferido pela equipe"
          checked={paid}
          onChange={setPaid}
        />
        <Button disabled={busy} onClick={() => update('Concluída')}>
          {b.status === 'Concluída' ? 'Atualizar pagamento / consumos' : 'Registrar check-out'}
        </Button>
      </>
    )}
    {closed && (
      <p className="fine">Reserva finalizada e pagamento conferido.</p>
    )}
    <p className="fine">
      Registro administrativo. A emissão de GRU, o pagamento e a
      conferência de comprovantes são realizados fora do site.
    </p>
  </>
)}

      {b.status === 'Recusada' && (
  <div className="actions">
    <Confirm
      label="Excluir reserva"
      description="Esta reserva recusada será apagada definitivamente e não poderá ser recuperada."
      run={remove}
    />
  </div>
)}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </article>
  );
}




// =====================================================================
// <Revenue /> — faturamento do mês selecionado e do ano.
// Conta apenas reservas "Concluída" com pagamento conferido, e usa a
// data de saída (end) para decidir a qual mês/ano o valor pertence.
// =====================================================================


// Valor final de uma reserva (mesma conta exibida no card).
const total = (b: any) =>
  b.data.quote.total * (1 - (b.data.discount || 0) / 100) + (b.data.consumption || 0);

function Revenue({ rows }: { rows: any[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0 = janeiro

  // Reservas que entram no faturamento.
  const billed = rows.filter((r) => r.status === 'Concluída' && r.data.paid === true);

  // Anos disponíveis no seletor (anos com dados + ano atual).
  const years = Array.from(
    new Set([now.getFullYear(), ...billed.map((r) => Number(r.end.slice(0, 4)))]),
  ).sort((a, b) => b - a);

  // "AAAA-MM-DD" -> compara pelo prefixo, sem problemas de fuso horário.
  const yearPrefix = String(year);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const inYear = billed.filter((r) => r.end.startsWith(yearPrefix));
  const inMonth = billed.filter((r) => r.end.startsWith(monthPrefix));

  const sum = (list: any[]) => list.reduce((acc, r) => acc + total(r), 0);

  // Faturamento mês a mês do ano selecionado (mini-resumo).
  const byMonth = MONTHS.map((_, i) => {
    const p = `${year}-${String(i + 1).padStart(2, '0')}`;
    return sum(billed.filter((r) => r.end.startsWith(p)));
  });

  return (
    <section className="panel" style={{ margin: '24px 0' }}>
      <h2>Faturamento</h2>
      <p className="fine">
        Considera reservas concluídas com pagamento conferido, pela data de saída.
      </p>

      <div className="field-grid">
        <Choice
          label="Mês"
          value={String(month)}
          onChange={(v: string) => setMonth(Number(v))}
          options={Object.fromEntries(MONTHS.map((m, i) => [String(i), m]))}
        />
        <Choice
          label="Ano"
          value={String(year)}
          onChange={(v: string) => setYear(Number(v))}
          options={Object.fromEntries(years.map((y) => [String(y), String(y)]))}
        />
      </div>

      <div className="stats">
        <div className="stat">
          <span>
            {MONTHS[month]} de {year}
          </span>
          <strong>{money(sum(inMonth))}</strong>
          <small>{inMonth.length} reserva(s)</small>
        </div>
        <div className="stat">
          <span>Total de {year}</span>
          <strong>{money(sum(inYear))}</strong>
          <small>{inYear.length} reserva(s)</small>
        </div>
      </div>

      {/* Resumo mês a mês; clicar em um mês muda o filtro. */}
      <div className="occupancy" style={{ marginTop: 16 }}>
        {byMonth.map((v, i) => (
          <div className="occupancy-item" key={i}>
            <Button
              variant={i === month ? 'default' : 'outline'}
              onClick={() => setMonth(i)}
              style={{ cursor: 'pointer'}}
            >
              {MONTHS[i].slice(0, 3)}
            </Button>
            <p>{money(v)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}



// =====================================================================
// <Staff /> — componente principal do painel: busca a lista de reservas
// na API e organiza a tela em três abas.
// =====================================================================
export default function Staff({ isAdmin = false }: { isAdmin?: boolean }) {
  const [rows, setRows] = useState<any[]>([]); // todas as reservas carregadas da API
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]); // cadastro de hóspedes
  const [guestsError, setGuestsError] = useState('');
  const [guestsLoading, setGuestsLoading] = useState(true);
  const [status, setStatus] = useState('Todas'); // filtro da aba "Reservas"
  const [month, setMonth] = useState('Todos');
  const [tab, setTab] = useState('reservas'); // aba ativa

  // Busca (ou recarrega) a lista de reservas na API.
  async function refresh() {
    setLoading(true);
    setError('');
    setGuestsError('');
    setGuestsLoading(true);
    // Os hóspedes são carregados em paralelo; uma falha neles não impede
    // de mostrar as reservas (e vice-versa).
    fetch('/api/hospedes')
      .then(async (r) => {
        const v: any = await r.json();
        if (!r.ok) throw Error(v.error);
        setGuests(v.guests);
      })
      .catch((e) =>
        setGuestsError(e instanceof Error ? e.message : 'Não foi possível carregar os hóspedes.'),
      )
      .finally(() => setGuestsLoading(false));
    try {
      const r = await fetch('/api/reservas');
      const v: any = await r.json();
      if (!r.ok) throw Error(v.error);
      setRows(v.bookings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  // Carrega as reservas assim que o painel abre.
  useEffect(() => {
    refresh();
  }, []);


  const router = useRouter();

  async function sair() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/equipe/login");
  }
  
  // Meses que aparecem no seletor: todos os meses tocados por alguma reserva.
  const monthSet = new Set<string>();
  rows.forEach((r) => {
    monthSet.add(r.start.slice(0, 7));
    monthSet.add(r.end.slice(0, 7));
  });
  const monthOptions: Record<string, string> = { Todos: 'Todos os meses' };
  Array.from(monthSet)
    .sort()
    .reverse()
    .forEach((m) => {
      monthOptions[m] = monthLabel(m);
    });
  
  // Reservas visíveis: respeitam a situação E o mês escolhido.
  const filtered = rows.filter(
    (r) =>
      (status === 'Todas' || r.status === status) &&
      (month === 'Todos' || (r.start.slice(0, 7) <= month && r.end.slice(0, 7) >= month)),
  );

  return (
    <>
      {/* ============================ CABEÇALHO ============================ */}
      <header>
        <a className="brand" href="/">
          <Mountain size={35} />
          <span>
            HOTEL DE TRÂNSITO
            <small>12º BI Mth · Administração</small>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <Button variant="outline" onClick={() => router.push('/equipe/admin')}>
              <ShieldCheck size={16} /> Administração
            </Button>
          )}
          <button onClick={sair}>Sair</button>
        </div>
      </header>

      <main>
        <div className="eyebrow">RECEPÇÃO E RESERVAS</div>
        <div className="page-heading">
          <div>
            <h1>Painel do hotel</h1>
            <p>Solicitações, ocupação e acompanhamento da hospedagem.</p>
          </div>
          <Button variant="outline" disabled={loading} onClick={refresh}>
            <RefreshCw size={16} /> Atualizar
          </Button>
        </div>

        {/* ------------------------- Cartões de estatística ------------------------- */}
        <div className="stats">
          {(
            [
              ['Pendentes', rows.filter((r) => r.status === 'Pendente').length],
              [
                'Chegadas hoje',
                rows.filter((r) => r.start === today() && r.status === 'Aprovada').length,
              ],
              [
                'Saídas hoje',
                rows.filter((r) => r.end === today() && r.status === 'Hospedado').length,
              ],
              ['Hospedados', rows.filter((r) => r.status === 'Hospedado').length],
            ] as const
          ).map(([label, value]) => (
            <div className="stat" key={label}>
              <span>{label}</span>
              <strong>{loading ? '—' : value}</strong>
            </div>
          ))}
        </div>

        {/* ================================ ABAS ================================ */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="tab-list">
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="ocupacao">Ocupação</TabsTrigger>
            <TabsTrigger value="hospedes">
              <Users size={16} /> Hóspedes
            </TabsTrigger>
            <TabsTrigger value="planilhas">
              <FileSpreadsheet size={16} /> Planilhas
            </TabsTrigger>
            <TabsTrigger value="faturamento">
              <Wallet size={16} /> Faturamento
            </TabsTrigger>
            <TabsTrigger value="controle">
              <Table2 size={16} /> Controle orçamentário
            </TabsTrigger>
            <TabsTrigger value="nova">
              <Plus size={16} /> Registrar pedido
            </TabsTrigger>
          </TabsList>
          
          {/* ------------------------- Aba: Reservas ------------------------- */}
          


          <TabsContent value="reservas">
            <div className="field-grid" style={{ maxWidth: 700, margin: '24px 0' }}>
              <Choice
                label="Situação"
                value={status}
                onChange={setStatus}
                options={Object.fromEntries(
                  ['Todas', 'Pendente', 'Aprovada', 'Hospedado', 'Concluída', 'Recusada', 'Cancelada'].map(
                    (s) => [s, s],
                  ),
                )}
              />
              <Choice
                label="Mês"
                value={month}
                onChange={setMonth}
                options={monthOptions}
              />
            </div>

                


            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <p role="status">Carregando reservas…</p>
            ) : (
              <div className="records">
                {filtered.map((b) => (
                  <Booking key={b.id + ':' + b.status} b={b} refresh={refresh} />
                ))}
                {filtered.length === 0 && (
                  <section className="panel">
                    <CalendarDays />
                    <h2>Nenhuma reserva neste filtro</h2>
                    <p>
                      Solicitações enviadas pelo site aparecerão aqui. Registre pedidos
                      recebidos por e-mail na aba “Registrar pedido”.
                    </p>
                  </section>
                )}
              </div>
            )}
          </TabsContent>

          {/* ------------------------- Aba: Ocupação ------------------------- */}
          <TabsContent value="ocupacao">
            <div className="occupancy">
              {['Q01', 'Q02', 'Q03', 'Q04'].map((room) => (
                <section className="panel" key={room}>
                  <h2>{room}</h2>
                  <p>
                    {room === 'Q01'
                      ? 'Hospedagem geral / Comando'
                      : room === 'Q04'
                        ? 'Pacientes D Sau'
                        : 'Hospedagem geral'}
                  </p>
                  {rows
                    .filter((r) => r.room === room && ['Aprovada', 'Hospedado'].includes(r.status))
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((r) => (
                      <div className="occupancy-item" key={r.id}>
                        <strong>
                          {date(r.start)} → {date(r.end)}
                        </strong>
                        <p>
                          {r.name} · {r.status}
                        </p>
                      </div>
                    ))}
                  {!rows.some((r) => r.room === room && ['Aprovada', 'Hospedado'].includes(r.status)) && (
                    <p>Sem reservas confirmadas.</p>
                  )}
                </section>
              ))}
            </div>
          </TabsContent>

          {/* --------------------- Aba: Registrar pedido --------------------- */}
          <TabsContent value="nova">
            <section className="panel" style={{ maxWidth: 800, marginTop: 24 }}>
              <h2>Registrar solicitação</h2>
              <p>
                Pedidos por e-mail e solicitações do Comando ou da Comunicação
                Social também passam pela aprovação.
              </p>
              {/* Reaproveita o MESMO formulário público, só que com
                  staff=true (libera campos extras) e onSaved={refresh}
                  para recarregar a lista assim que o pedido for salvo. */}
              <BookingForm staff onSaved={refresh} />
            </section>
          </TabsContent>

          {/* --------------------- Aba: Hóspedes --------------------- */}
          <TabsContent value="hospedes">
            <Hospedes guests={guests} rows={rows} loading={loading || guestsLoading} error={guestsError} />
          </TabsContent>

          {/* --------------------- Aba: Planilhas --------------------- */}
          <TabsContent value="planilhas">
            <Planilhas />
          </TabsContent>

          <TabsContent value="faturamento">
            <Revenue rows={rows} />
          </TabsContent>

          <TabsContent value="controle">
            <ControleOrcamentario rows={rows} />
          </TabsContent>

        </Tabs>
      </main>
    </>
  );

}