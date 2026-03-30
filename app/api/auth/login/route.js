import { NextResponse } from 'next/server';
import { authenticateUser, generateToken, generateRefreshToken } from '@/lib/jwt';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Now this is async
    const user = await authenticateUser(username, password);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set cookie for token (optional but recommended)
    const response = NextResponse.json({
      success: true,
      data: {
        token,
        refreshToken,
        user
      }
    });

    // Set HTTP-only cookie for better security
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 48 * 60 * 60, // 48 hours
      path: '/',
    });

    return response;
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Login failed' },
      { status: 500 }
    );
  }
}