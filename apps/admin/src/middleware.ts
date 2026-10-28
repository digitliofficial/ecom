import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_STUB_COOKIE, parseStubSessionValue } from './lib/auth-session';

export function middleware(request: NextRequest) {
  const session = parseStubSessionValue(request.cookies.get(ADMIN_STUB_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login' || pathname.startsWith('/login/');

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
