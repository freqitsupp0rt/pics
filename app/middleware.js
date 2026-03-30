// middleware.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export async function middleware(request) {
  // Check if the request is for an API route that requires auth
  if (request.nextUrl.pathname.startsWith('/api/auth/me')) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // No token, let the API route handle the response
      return NextResponse.next();
    }

    try {
      const decoded = verifyToken(token);
      // Add user to request headers so the API route can access it
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user', JSON.stringify(decoded));
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      // Token is invalid, let the API route handle the error response
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/me'],
};