import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  STAFF_SESSION_COOKIE,
  hasStaffSessionCookie,
} from './lib/auth-session';

export function middleware(request: NextRequest) {
  const session = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const loggedIn = hasStaffSessionCookie(session);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login' || pathname.startsWith('/login/');

  if (!loggedIn && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (loggedIn && isLogin) {
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
