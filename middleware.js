import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const sessao = request.cookies.get("sessao");

  // Libera a página de login, mesmo estando dentro de /equipe
  if (pathname.startsWith("/equipe/login")) {
    return NextResponse.next();
  }

  // Protege o restante de /equipe
  if (!sessao) {
    return NextResponse.redirect(new URL("/equipe/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/equipe/:path*"],
};