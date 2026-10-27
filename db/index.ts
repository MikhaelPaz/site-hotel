// db/index.ts
// -----------------------------------------------------------------------
// Ponto único para obter uma conexão "Drizzle" com o banco (Cloudflare
// D1). Diferente de lib/server.ts (que devolve o binding "cru" do D1,
// usado com SQL puro em app/api/reservas/route.ts), esta função devolve
// o banco já "envolvido" pelo Drizzle ORM, junto com o esquema definido
// em db/schema.ts — útil caso outras partes do projeto queiram consultar
// o banco de forma mais tipada, em vez de escrever SQL na mão.
// -----------------------------------------------------------------------

import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.',
    );
  }

  return drizzle(env.DB, { schema });
}
