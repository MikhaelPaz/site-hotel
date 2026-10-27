// lib/auth.ts
// -----------------------------------------------------------------------
// LOGIN DA EQUIPE guardado no banco (tabelas "users" e "sessions").
//
//  - Senhas: guardadas só como hash PBKDF2-SHA256 (Web Crypto, funciona no
//    Cloudflare Workers), com "sal" aleatório por usuário.
//  - Sessão: o cookie "sessao" leva um código aleatório; no banco fica só o
//    hash dele. Não dá para forjar o cookie e apagar a linha desloga na hora.
// -----------------------------------------------------------------------

import { env } from 'cloudflare:workers';

// (Não importa lib/server.ts para evitar import circular: lib/server.ts é
// quem importa este arquivo.)
function database() {
  if (!env.DB) throw Error('Serviço indisponível.');
  return env.DB;
}

export const SESSION_COOKIE = 'sessao';
export const SESSION_SECONDS = 60 * 60 * 8; // 8 horas
export const MIN_PASSWORD = 8;
const ITERATIONS = 100_000; // limite máximo aceito pelo Cloudflare Workers

export type Role = 'admin' | 'equipe';
export type SessionUser = { id: string; username: string; name: string; role: Role };

const enc = new TextEncoder();
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) =>
  new Uint8Array((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16)));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

// Gera o texto guardado no banco: pbkdf2$iterações$sal$hash
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(await derive(password, salt, ITERATIONS))}`;
}

// Compara em tempo constante (não vaza, pelo tempo de resposta, quantos
// caracteres batem).
export async function verifyPassword(password: string, stored: string) {
  const [kind, iter, salt, hash] = stored.split('$');
  if (kind !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const got = await derive(password, fromHex(salt), Number(iter));
  const want = fromHex(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

async function sha256Hex(text: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

// Usuário de login: minúsculo e sem espaços nas pontas.
export const normalizeUsername = (s: string) => s.trim().toLowerCase();
// 3 a 30 caracteres: letras, números, ponto, hífen e sublinhado.
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

// Cria uma sessão para o usuário e devolve o código que vai no cookie.
export async function createSession(userId: string) {
  const db = database();
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires < ?').bind(now.toISOString()), // faxina
    db
      .prepare('INSERT INTO sessions (token_hash,user_id,created,expires) VALUES (?,?,?,?)')
      .bind(await sha256Hex(token), userId, now.toISOString(), expires.toISOString()),
    db.prepare('UPDATE users SET last_login=? WHERE id=?').bind(now.toISOString(), userId),
  ]);
  return token;
}

export async function destroySession(token: string | null) {
  if (!token) return;
  await database()
    .prepare('DELETE FROM sessions WHERE token_hash=?')
    .bind(await sha256Hex(token))
    .run();
}

// Devolve o usuário dono do código, se a sessão ainda vale e o login está ativo.
export async function userFromToken(token: string | null): Promise<SessionUser | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row: any = await database()
    .prepare(
      'SELECT u.id,u.username,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1',
    )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first();
  return row ? { id: row.id, username: row.username, name: row.name, role: row.role } : null;
}

// Lê o cookie "sessao" de uma requisição.
export function tokenFromRequest(req: Request) {
  const part = (req.headers.get('cookie') || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(SESSION_COOKIE + '='));
  return part ? part.slice(SESSION_COOKIE.length + 1) : null;
}

export async function getSessionUser(req: Request) {
  try {
    return await userFromToken(tokenFromRequest(req));
  } catch (e) {
    console.error('[auth]', e);
    return null;
  }
}
