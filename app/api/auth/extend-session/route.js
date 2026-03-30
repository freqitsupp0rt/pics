import { NextResponse } from 'next/server';
import { verifyToken, generateToken, generateRefreshToken, getUserById } from '@/lib/jwt';

export async function POST(request) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'Refresh token required' },
        { status: 400 }
      );
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      return NextResponse.json(
        { success: false, message: 'Invalid token type' },
        { status: 401 }
      );
    }

    // Get fresh user data from database
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Verify username matches (extra security)
    if (user.username !== decoded.username) {
      return NextResponse.json(
        { success: false, message: 'Token mismatch' },
        { status: 401 }
      );
    }

    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const response = NextResponse.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        user
      }
    });

    // Update cookie with new token
    response.cookies.set('auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 48 * 60 * 60, // 48 hours
      path: '/',
    });

    return response;
    
  } catch (error) {
    console.error('Extend session error:', error);
    
    // Clear invalid cookies
    const response = NextResponse.json(
      { success: false, message: 'Failed to extend session' },
      { status: 401 }
    );
    
    response.cookies.delete('auth_token');
    
    return response;
  }
}