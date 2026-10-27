// app/api/hospedes/route.ts
// -----------------------------------------------------------------------
// API de HÓSPEDES (responde em "/api/hospedes").
//
//   GET /api/hospedes -> lista o cadastro de hóspedes (nome, e-mail e
//                        telefone), do mais recente para o mais antigo.
//
// O cadastro é alimentado automaticamente a cada nova reserva (veja o POST
// em app/api/reservas/route.ts). Como são dados pessoais, só responde a
// quem está logado na área da equipe.
// -----------------------------------------------------------------------

import { database, isStaff } from '@/lib/server';

export async function GET(req: Request) {
  if (!(await isStaff(req))) {
    return Response.json({ error: 'Faça login para ver os hóspedes.' }, { status: 401 });
  }
  try {
    const r = await database()
      .prepare('SELECT id,name,email,phone,created,updated FROM guests ORDER BY updated DESC')
      .all();
    return Response.json(
      { guests: r.results },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[hospedes GET]', e);
    const missing = /no such table: guests/i.test(String(e instanceof Error ? e.message : e));
    return Response.json(
      {
        error: missing
          ? 'O banco ainda não recebeu a atualização de hóspedes (arquivo drizzle/0001_guests.sql). Aplique a migração e atualize a página.'
          : 'Não foi possível carregar os hóspedes.',
      },
      { status: 503 },
    );
  }
}
