// app/api/logout/route.ts
// POST /api/logout — encerra a sessão no banco e apaga o cookie.

import { NextResponse } from 'next/server';
import { SESSION_COOKIE, destroySession, tokenFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await destroySession(tokenFromRequest(request));
  } catch (e) {
    console.error('[logout]', e);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
