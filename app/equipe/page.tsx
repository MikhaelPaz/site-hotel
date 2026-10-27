import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, userFromToken } from '@/lib/auth';
import Staff from './staff';
export const dynamic = 'force-dynamic';

// Confere a sessão no banco. Sem login válido (ou com o cookie antigo/forjado),
// a pessoa é enviada para a tela de login da equipe.
export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  let user = null;
  try {
    user = await userFromToken(token);
  } catch (e) {
    console.error('[equipe]', e);
  }
  if (!user) redirect('/equipe/login');

  return <Staff isAdmin={user.role === 'admin'} />;
}
