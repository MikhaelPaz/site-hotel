import {env} from 'cloudflare:workers';
import { getSessionUser } from '@/lib/auth';
export function database(){if(!env.DB)throw Error('Serviço indisponível.');return env.DB}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin}

// Confere se a requisição veio de alguém logado na área da equipe (sessão
// válida no banco, veja lib/auth.ts). Usado em rotas que devolvem dados
// pessoais, como /api/hospedes.
export async function isStaff(req: Request) {
  return (await getSessionUser(req)) !== null;
}
