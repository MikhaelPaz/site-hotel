// app/api/comprovantes/route.ts
// -----------------------------------------------------------------------
// API dos COMPROVANTES DE PAGAMENTO (responde em "/api/comprovantes").
// Só para quem está logado na área da equipe.
//
//   GET                  -> lista quais reservas têm comprovante (sem o arquivo)
//   GET  ?id=<reserva>   -> devolve o arquivo (abre no navegador)
//   POST (FormData)      -> anexa/substitui:  bookingId + file
//   DELETE { bookingId } -> remove
//
// O arquivo é guardado no banco (tabela "receipts"). Como uma linha do D1
// aceita no máximo ~2 MB, o limite do arquivo é MAX_BYTES (em base64 o
// arquivo cresce 33%). O tipo é decidido pelo CONTEÚDO do arquivo, nunca
// pelo nome ou pelo tipo informado, e só PDF/JPG/PNG/WebP são aceitos.
// -----------------------------------------------------------------------

import { database, sameOrigin } from '@/lib/server';
import { getSessionUser } from '@/lib/auth';

const MAX_BYTES = 1_300_000;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Descobre o tipo pelos primeiros bytes do arquivo.
function detectMime(b: Uint8Array): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'; // RIFF....WEBP
  return null;
}

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function fail(e: unknown, what: string) {
  console.error(`[comprovantes ${what}]`, e);
  const missing = /no such table: receipts/i.test(String(e instanceof Error ? e.message : e));
  return json(
    {
      error: missing
        ? 'O banco ainda não recebeu a atualização de comprovantes (arquivo drizzle/0004_receipts.sql).'
        : 'Não foi possível concluir a operação.',
    },
    missing ? 503 : 500,
  );
}

export async function GET(req: Request) {
  const me = await getSessionUser(req);
  if (!me) return json({ error: 'Faça login para continuar.' }, 401);
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      const r = await database()
        .prepare('SELECT booking_id AS bookingId,file_name AS fileName,mime,size,uploaded FROM receipts')
        .all();
      return json({ receipts: r.results });
    }
    const row: any = await database()
      .prepare('SELECT file_name,mime,data FROM receipts WHERE booking_id=?')
      .bind(id)
      .first();
    if (!row) return json({ error: 'Comprovante não encontrado.' }, 404);
    return new Response(fromBase64(row.data), {
      headers: {
        'Content-Type': row.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return fail(e, 'GET');
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Origem inválida.' }, 403);
  const me = await getSessionUser(req);
  if (!me) return json({ error: 'Faça login para continuar.' }, 401);
  try {
    const form = await req.formData();
    const bookingId = String(form.get('bookingId') ?? '');
    const file = form.get('file');
    if (!bookingId || !(file instanceof File)) {
      return json({ error: 'Escolha um arquivo.' }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: 'Arquivo grande demais (máximo de 1,3 MB).' }, 413);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectMime(bytes);
    if (!mime) return json({ error: 'Envie um PDF ou uma imagem (JPG, PNG ou WebP).' }, 400);

    const db = database();
    const exists = await db.prepare('SELECT 1 AS ok FROM bookings WHERE id=?').bind(bookingId).first();
    if (!exists) return json({ error: 'Reserva não encontrada.' }, 404);

    const name = (file.name || 'comprovante').replace(/[\r\n"\\/]/g, '_').slice(0, 120);
    await db
      .prepare(
        'INSERT OR REPLACE INTO receipts (booking_id,file_name,mime,size,data,uploaded,uploaded_by) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(bookingId, name, mime, bytes.length, toBase64(bytes), new Date().toISOString(), me.username)
      .run();
    return json({ ok: true });
  } catch (e) {
    return fail(e, 'POST');
  }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Origem inválida.' }, 403);
  const me = await getSessionUser(req);
  if (!me) return json({ error: 'Faça login para continuar.' }, 401);
  try {
    const raw: any = await req.json();
    await database().prepare('DELETE FROM receipts WHERE booking_id=?').bind(String(raw?.bookingId ?? '')).run();
    return json({ ok: true });
  } catch (e) {
    return fail(e, 'DELETE');
  }
}
