// app/equipe/controle-orcamentario.tsx
// -----------------------------------------------------------------------
// Aba "Controle orçamentário" do painel da equipe: tabela com uma linha
// para cada reserva que já teve o CHECK-OUT realizado (situação
// "Concluída"), com:
//   nome completo · quantidade de hóspedes · check-in · check-out ·
//   valor pago · número de referência
//
// Não há tabela nova no banco: as linhas são montadas a partir das
// reservas (props "rows", vindas de /api/reservas). O valor pago e o
// número de referência são digitados pela equipe na hora do check-out
// (cartão da reserva, em staff.tsx) e ficam em booking.data.paidAmount e
// booking.data.paymentReference.
// -----------------------------------------------------------------------

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Paperclip, Table2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { money } from '@/lib/rules';

// "AAAA-MM-DD" -> "DD/MM/AAAA".
const date = (s: string) => s.split('-').reverse().join('/');

// Minúsculas e sem acentos, para a busca achar "joao" ao procurar "João".
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

type Entry = {
  id: string;
  name: string;
  guests: number;
  start: string;
  end: string;
  amount: number | null; // valor pago (null = ainda não informado)
  reference: string;
  paid: boolean; // pagamento conferido pela equipe
};

// Transforma uma reserva "Concluída" em uma linha da tabela.
function toEntry(b: any): Entry {
  const d = b.data;
  // Valor total da estadia (mesma conta do cartão da reserva).
  const total = d.quote.total * (1 - (d.discount || 0) / 100) + (d.consumption || 0);
  return {
    id: b.id,
    name: b.name,
    // solicitante + dependentes + acompanhantes + crianças
    guests: 1 + (d.dependents || 0) + (d.others || 0) + (d.children || 0),
    start: b.start,
    end: b.end,
    // Reservas fechadas ANTES desta função existir não têm "valor pago"
    // gravado: nelas, se o pagamento foi conferido, usamos o total.
    amount: d.paidAmount ?? (d.paid === true ? total : null),
    reference: d.paymentReference || '',
    paid: d.paid === true,
  };
}

// Evita "injeção de fórmula" ao abrir o CSV no Excel/Planilhas: textos que
// começam com = + - @ ganham um apóstrofo na frente.
const csvText = (v: string) => {
  const t = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return '"' + t.replace(/"/g, '""') + '"';
};

// ---- COMPROVANTE DE PAGAMENTO ------------------------------------------
// Limite do arquivo (o servidor confere de novo, veja app/api/comprovantes).
const MAX_BYTES = 1_300_000;

type Receipt = { bookingId: string; fileName: string; mime: string; size: number; uploaded: string };

// Prepara o arquivo escolhido: PDF e imagens pequenas seguem como estão;
// imagens grandes (foto do celular) são reduzidas e viram JPEG para caber.
async function prepareFile(file: File): Promise<File> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw Error('O PDF passa de 1,3 MB. Envie uma foto/captura do comprovante ou um PDF menor.');
    return file;
  }
  if (!file.type.startsWith('image/')) throw Error('Envie um PDF ou uma imagem (JPG ou PNG).');
  if (file.size <= MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw Error('Não foi possível ler essa imagem. Use JPG, PNG ou PDF.');
  }
  let scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // PNG transparente vira fundo branco no JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
    if (blob && blob.size <= MAX_BYTES) {
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
    scale *= 0.75;
  }
  throw Error('Não foi possível reduzir a imagem o bastante. Tente uma captura de tela ou um PDF.');
}

// Botões de comprovante de UMA linha: anexar / ver / trocar / remover.
function ReceiptCell({
  id,
  receipt,
  busy,
  onUpload,
  onRemove,
}: {
  id: string;
  receipt?: Receipt;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permite escolher o mesmo arquivo de novo
          if (f) onUpload(f);
        }}
      />
      {receipt ? (
        <>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/comprovantes?id=${encodeURIComponent(id)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={receipt.fileName}
            >
              <FileText size={14} /> Ver
            </a>
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            Trocar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy} aria-label="Remover comprovante">
                <Trash2 size={14} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover o comprovante?</AlertDialogTitle>
                <AlertDialogDescription>
                  O arquivo “{receipt.fileName}” será apagado. Você pode anexar outro depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <Paperclip size={14} /> {busy ? 'Enviando…' : 'Anexar'}
        </Button>
      )}
    </div>
  );
}

export default function ControleOrcamentario({ rows }: { rows: any[] }) {
  const [q, setQ] = useState('');
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [busyId, setBusyId] = useState('');
  const [receiptError, setReceiptError] = useState('');

  // Carrega quais reservas já têm comprovante.
  async function loadReceipts() {
    try {
      const r = await fetch('/api/comprovantes');
      const v: any = await r.json();
      if (!r.ok) throw Error(v.error);
      setReceipts(Object.fromEntries((v.receipts as Receipt[]).map((x) => [x.bookingId, x])));
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Não foi possível carregar os comprovantes.');
    }
  }
  useEffect(() => {
    loadReceipts();
  }, []);

  async function uploadReceipt(id: string, original: File) {
    setReceiptError('');
    setBusyId(id);
    try {
      const file = await prepareFile(original);
      const fd = new FormData();
      fd.append('bookingId', id);
      fd.append('file', file, file.name);
      const r = await fetch('/api/comprovantes', { method: 'POST', body: fd });
      const v: any = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(v.error || 'Não foi possível enviar o comprovante.');
      await loadReceipts();
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Não foi possível enviar o comprovante.');
    } finally {
      setBusyId('');
    }
  }

  async function removeReceipt(id: string) {
    setReceiptError('');
    setBusyId(id);
    try {
      const r = await fetch('/api/comprovantes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id }),
      });
      const v: any = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(v.error || 'Não foi possível remover.');
      await loadReceipts();
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Não foi possível remover.');
    } finally {
      setBusyId('');
    }
  }

  // Todas as reservas com check-out realizado, da saída mais recente
  // para a mais antiga.
  const entries = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'Concluída')
        .map(toEntry)
        .sort((a, b) => b.end.localeCompare(a.end) || a.name.localeCompare(b.name, 'pt-BR')),
    [rows],
  );

  // Pesquisa por nome ou número de referência (várias palavras refinam).
  const shown = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return entries;
    return entries.filter((e) => {
      const text = norm(`${e.name} ${e.reference}`);
      return tokens.every((t) => text.includes(t));
    });
  }, [entries, q]);

  const totalPaid = shown.reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const totalGuests = shown.reduce((acc, e) => acc + e.guests, 0);

  // Baixa o que está na tabela (já filtrado) como CSV, no padrão que o
  // Excel brasileiro abre direto (separador ";", decimal com vírgula).
  function exportCsv() {
    const head = [
      'Nome completo',
      'Quantidade de hóspedes',
      'Check-in',
      'Check-out',
      'Valor pago (R$)',
      'Número de referência',
      'Pagamento',
      'Comprovante anexado',
    ];
    const lines = shown.map((e) =>
      [
        csvText(e.name),
        e.guests,
        date(e.start),
        date(e.end),
        e.amount == null ? '' : e.amount.toFixed(2).replace('.', ','),
        csvText(e.reference),
        e.paid ? 'Conferido' : 'Pendente',
        receipts[e.id] ? 'Sim' : 'Não',
      ].join(';'),
    );
    const csv = '\uFEFF' + [head.join(';'), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'controle-orcamentario.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div className="field-grid" style={{ maxWidth: 700, marginBottom: 8 }}>
        <label>
          Pesquisar
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou número de referência"
            autoComplete="off"
          />
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <p className="fine" role="status" style={{ margin: 0 }}>
          {q.trim()
            ? `${shown.length} de ${entries.length} registro(s)`
            : `${entries.length} registro(s) de check-out`}
        </p>
        <Button variant="outline" onClick={exportCsv} disabled={shown.length === 0}>
          <Download size={16} /> Baixar CSV
        </Button>
      </div>

      {receiptError && (
        <p className="error" role="alert" style={{ marginBottom: 12 }}>
          {receiptError}
        </p>
      )}

      {shown.length === 0 ? (
        <section className="panel">
          <Table2 />
          <h2>{entries.length === 0 ? 'Nenhum check-out registrado' : 'Nada encontrado'}</h2>
          <p>
            {entries.length === 0
              ? 'Quando um check-out for registrado na aba Reservas, a linha aparece aqui automaticamente.'
              : 'Confira a grafia ou busque só por parte do nome ou da referência.'}
          </p>
        </section>
      ) : (
        <div className="table-wrap" >
          <table className="data-table">
            <thead>
              <tr>
                <th>Nº de referência</th>
                <th>Nome completo</th>
                <th className="num">Hóspedes</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th className="num">Valor pago</th>
                
                <th>Pagamento</th>
                <th>Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>{e.reference || '—'}</td>
                  <td>{e.name}</td>
                  <td className="num">{e.guests}</td>
                  <td>{date(e.start)}</td>
                  <td>{date(e.end)}</td>
                  <td className="num">{e.amount == null ? '—' : money(e.amount)}</td>
                  
                  <td>{e.paid ? 'Conferido' : 'Pendente'}</td>
                  <td>
                    <ReceiptCell
                      id={e.id}
                      receipt={receipts[e.id]}
                      busy={busyId === e.id}
                      onUpload={(f) => uploadReceipt(e.id, f)}
                      onRemove={() => removeReceipt(e.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total ({shown.length})</td>
                <td />

                <td className="num">{totalGuests}</td>
                <td />
                <td />
                <td className="num">{money(totalPaid)}</td>
                <td />
                <td />
                
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
