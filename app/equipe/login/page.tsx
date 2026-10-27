import { redirect } from 'next/navigation';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import LoginEquipe from '../login';

export const dynamic = 'force-dynamic';

// Se a pessoa já está logada, vai direto para o painel.
export default async function Page() {
  return <LoginEquipe />;
}
