import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, userFromToken } from '@/lib/auth';
import Admin from './admin';
export const dynamic = 'force-dynamic';

// Página de administração dos logins: só para quem é admin.
export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  let user = null;
  try {
    user = await userFromToken(token);
  } catch (e) {
    console.error('[admin]', e);
  }
  if (!user) redirect('/equipe/login');
  if (user.role !== 'admin') redirect('/equipe');

  return <Admin />;
}
