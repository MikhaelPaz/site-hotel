// app/chatgpt-auth.ts
// -----------------------------------------------------------------------
// Este arquivo cuida do LOGIN da área restrita da equipe ("/equipe").
// A autenticação em si não acontece aqui: o site está hospedado numa
// plataforma que já autentica o usuário via ChatGPT (login social) e
// repassa os dados da pessoa logada através de cabeçalhos HTTP especiais
// (algo como "oai-authenticated-user-id"). Este arquivo só LÊ esses
// cabeçalhos e oferece funções prontas para o resto do código usar.
// -----------------------------------------------------------------------

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Formato dos dados do usuário autenticado, já "traduzidos" dos
// cabeçalhos HTTP para um objeto TypeScript tipado.
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

// Nomes dos cabeçalhos HTTP enviados pela plataforma de hospedagem.
const USER_ID_HEADER = 'oai-authenticated-user-id';
const USER_EMAIL_HEADER = 'oai-authenticated-user-email';
const USER_FULL_NAME_HEADER = 'oai-authenticated-user-full-name';
const USER_FULL_NAME_ENCODING_HEADER = 'oai-authenticated-user-full-name-encoding';
const PERCENT_ENCODED_UTF8 = 'percent-encoded-utf-8';

// Caminhos especiais de autenticação, tratados pela própria plataforma
// (não são páginas deste projeto Next.js).
const SIGN_IN_PATH = '/signin-with-chatgpt';
const SIGN_OUT_PATH = '/signout-with-chatgpt';
const CALLBACK_PATH = '/callback';

// Lê os cabeçalhos da requisição atual e devolve os dados do usuário
// logado, ou `null` se ninguém estiver autenticado.
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  // O nome completo, quando presente, pode vir "percent-encoded" (URL
  // encoding) para suportar acentos e caracteres especiais com
  // segurança nos cabeçalhos HTTP; aqui a gente decodifica isso.
  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    displayName: fullName ?? email, // usa o e-mail como nome se não houver nome completo
    email,
    fullName,
  };
}

// Versão "obrigatória": se não houver usuário logado, redireciona
// automaticamente para a tela de login, já configurada para voltar
// (`returnTo`) para a página que o usuário estava tentando acessar.
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

// Monta a URL de login, incluindo para onde voltar depois.
export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

// Monta a URL de logout, incluindo para onde voltar depois.
export function chatGPTSignOutPath(returnTo = '/'): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

// Garante que o "returnTo" é sempre um caminho RELATIVO e seguro dentro
// do próprio site — nunca uma URL externa (ex: "https://site-malicioso.com").
// Isso evita um tipo de ataque chamado "open redirect", em que alguém
// monta um link de login do seu site que, no final, manda a vítima para
// outro lugar.
function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';

  let url: URL;
  try {
    // Usamos uma origem "falsa" só para conseguir usar o parser de URL
    // do navegador/Node com segurança sobre um caminho relativo.
    url = new URL(value, 'https://app.local');
  } catch {
    return '/';
  }
  if (url.origin !== 'https://app.local') return '/';
  if (isReservedAuthPath(url.pathname)) return '/';

  return `${url.pathname}${url.search}${url.hash}`;
}

// Impede que o "voltar para" aponte para as próprias páginas de
// login/logout/callback (evitaria loops estranhos de redirecionamento).
function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH || pathname === SIGN_OUT_PATH || pathname === CALLBACK_PATH
  );
}

// decodeURIComponent pode lançar erro com entradas malformadas; aqui
// isso é tratado com segurança, devolvendo `null` em vez de quebrar a
// página inteira.
function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
