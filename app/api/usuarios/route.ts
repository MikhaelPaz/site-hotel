// app/api/usuarios/route.ts
// -----------------------------------------------------------------------
// API de LOGINS da equipe (responde em "/api/usuarios"). Só para quem está
// logado como ADMIN (usada pela página /equipe/admin).
//
//   GET    -> lista os logins
//   POST   -> cria um login            { name, username, password, role }
//   PATCH  -> altera um login          { id, name?, username?, password?, role?, active? }
//   DELETE -> remove um login          { id }
//
// Proteções: não dá para remover/bloquear/rebaixar a si mesmo nem o último
// administrador ativo (senão ninguém mais conseguiria entrar na página).
// Remover, bloquear ou trocar a senha derruba as sessões abertas da pessoa.
// -----------------------------------------------------------------------

import { database, sameOrigin } from '@/lib/server';
import { MIN_PASSWORD, getSessionUser, hashPassword, normalizeUsername, USERNAME_RE } from '@/lib/auth';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });


// Confere se quem chamou é admin. Devolve o admin, ou uma resposta de erro.
async function requireAdmin(req: Request) {
  const me = await getSessionUser(req);
  if (!me) return { error: json({ error: 'Faça login para continuar.' }, 401) };
  if (me.role !== 'admin') return { error: json({ error: 'Apenas administradores.' }, 403) };
  return { me };
}

// Quantos admins ativos existem, sem contar o usuário `exceptId`.
async function otherActiveAdmins(exceptId: string) {
  const r: any = await database()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1 AND id<>?")
    .bind(exceptId)
    .first();
  return Number(r?.n ?? 0);
}

function fail(e: unknown, what: string) {
  console.error(`[usuarios ${what}]`, e);
  const msg = String(e instanceof Error ? e.message : e);
  if (/no such table: users/i.test(msg)) {
    return json(
      { error: 'O banco ainda não recebeu a atualização de logins (arquivo drizzle/0002_users.sql).' },
      503,
    );
  }
  return json({ error: 'Não foi possível concluir a operação.' }, 500);
}

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a.error) return a.error;
  try {
    const r = await database()
      .prepare(
        'SELECT id,username,name,role,active,created,updated,last_login AS lastLogin FROM users ORDER BY name COLLATE NOCASE',
      )
      .all();
    return json({ users: r.results, meId: a.me!.id });
  } catch (e) {
    return fail(e, 'GET');
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Origem inválida.' }, 403);
  const a = await requireAdmin(req);
  if (a.error) return a.error;
  try {
    const raw: any = await req.json();
    const name = String(raw?.name ?? '').trim();
    const username = normalizeUsername(String(raw?.username ?? ''));
    const password = String(raw?.password ?? '');
    const role = raw?.role === 'admin' ? 'admin' : 'equipe';

    if (name.length < 2 || name.length > 100) return json({ error: 'Informe o nome.' }, 400);
    if (!USERNAME_RE.test(username)) {
      return json({ error: 'Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.' }, 400);
    }
    if (password.length < MIN_PASSWORD || password.length > 200) {
      return json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
    }

    const now = new Date().toISOString();
    try {
      await database()
        .prepare(
          'INSERT INTO users (id,username,name,password_hash,role,active,created,updated) VALUES (?,?,?,?,?,1,?,?)',
        )
        .bind(crypto.randomUUID(), username, name, await hashPassword(password), role, now, now)
        .run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e instanceof Error ? e.message : e))) {
        return json({ error: 'Já existe um login com esse usuário.' }, 409);
      }
      throw e;
    }
    return json({ ok: true }, 201);
  } catch (e) {
    return fail(e, 'POST');
  }
}

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Origem inválida.' }, 403);
  const a = await requireAdmin(req);
  if (a.error) return a.error;
  try {
    const raw: any = await req.json();
    const id = String(raw?.id ?? '');
    const db = database();
    const cur: any = await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    if (!cur) return json({ error: 'Login não encontrado.' }, 404);

    const name = raw.name !== undefined ? String(raw.name).trim() : cur.name;
    const username = raw.username !== undefined ? normalizeUsername(String(raw.username)) : cur.username;
    const role = raw.role !== undefined ? (raw.role === 'admin' ? 'admin' : 'equipe') : cur.role;
    const active = raw.active !== undefined ? (raw.active ? 1 : 0) : cur.active;
    const password = raw.password ? String(raw.password) : '';

    if (name.length < 2 || name.length > 100) return json({ error: 'Informe o nome.' }, 400);
    if (!USERNAME_RE.test(username)) {
      return json({ error: 'Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.' }, 400);
    }
    if (password && (password.length < MIN_PASSWORD || password.length > 200)) {
      return json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
    }

    const isMe = id === a.me!.id;
    if (isMe && (role !== 'admin' || !active)) {
      return json({ error: 'Você não pode tirar o seu próprio acesso de administrador.' }, 400);
    }
    const losesAdmin = cur.role === 'admin' && cur.active === 1 && (role !== 'admin' || !active);
    if (losesAdmin && (await otherActiveAdmins(id)) === 0) {
      return json({ error: 'Precisa existir pelo menos um administrador ativo.' }, 400);
    }

    const hash = password ? await hashPassword(password) : cur.password_hash;
    try {
      await db
        .prepare('UPDATE users SET name=?,username=?,role=?,active=?,password_hash=?,updated=? WHERE id=?')
        .bind(name, username, role, active, hash, new Date().toISOString(), id)
        .run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e instanceof Error ? e.message : e))) {
        return json({ error: 'Já existe um login com esse usuário.' }, 409);
      }
      throw e;
    }

    // Senha trocada, bloqueio ou mudança de papel: derruba as sessões abertas
    // (exceto a de quem está editando o próprio cadastro).
    if (!isMe && (password || !active || role !== cur.role)) {
      await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
    }
    return json({ ok: true });
  } catch (e) {
    return fail(e, 'PATCH');
  }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Origem inválida.' }, 403);
  const a = await requireAdmin(req);
  if (a.error) return a.error;
  try {
    const raw: any = await req.json();
    const id = String(raw?.id ?? '');
    if (id === a.me!.id) return json({ error: 'Você não pode remover o seu próprio login.' }, 400);

    const db = database();
    const cur: any = await db.prepare('SELECT role,active FROM users WHERE id=?').bind(id).first();
    if (!cur) return json({ error: 'Login não encontrado.' }, 404);
    if (cur.role === 'admin' && cur.active === 1 && (await otherActiveAdmins(id)) === 0) {
      return json({ error: 'Precisa existir pelo menos um administrador ativo.' }, 400);
    }

    await db.batch([
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
      db.prepare('DELETE FROM users WHERE id=?').bind(id),
    ]);
    return json({ ok: true });
  } catch (e) {
    return fail(e, 'DELETE');
  }
}
