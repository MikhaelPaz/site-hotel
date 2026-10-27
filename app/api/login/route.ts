// app/api/login/route.ts
// -----------------------------------------------------------------------
// POST /api/login  { usuario, senha }
// Confere e-mail e senha na tabela "users" (banco) e, se estiver certo,
// abre uma sessão e grava o cookie "sessao". Não há mais e-mail/senha
// escritos no código.
// -----------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { database, sameOrigin } from '@/lib/server';
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  createSession,
  hashPassword,
  normalizeUsername,
  verifyPassword,
} from '@/lib/auth';

// Hash de uma senha qualquer: usado para gastar o mesmo tempo quando o
// e-mail não existe (assim não dá para descobrir e-mails cadastrados
// medindo o tempo de resposta).
let dummyHash: Promise<string> | null = null;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });

  let username = '';
  let senha = '';
  try {
    const body: any = await request.json();
    username = normalizeUsername(String(body?.usuario ?? ''));
    senha = String(body?.senha ?? '');
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!username || !senha || senha.length > 200) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const user: any = await database()
      .prepare('SELECT id,password_hash,active FROM users WHERE username=?')
      .bind(username)
      .first();

    dummyHash ??= hashPassword(crypto.randomUUID());
    const ok = await verifyPassword(senha, user ? user.password_hash : await dummyHash);

    if (!user || !ok || user.active !== 1) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(request.url).protocol === 'https:',
      path: '/',
      maxAge: SESSION_SECONDS,
    });
    return res;
  } catch (e) {
    console.error('[login]', e);
    const missing = /no such table: (users|sessions)/i.test(String(e instanceof Error ? e.message : e));
    return NextResponse.json(
      {
        ok: false,
        error: missing
          ? 'O banco ainda não recebeu a atualização de logins (arquivo drizzle/0002_users.sql). Aplique a migração.'
          : 'Não foi possível entrar agora. Tente novamente.',
      },
      { status: 503 },
    );
  }
}
