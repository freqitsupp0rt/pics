import { NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/jwt';

export async function GET(request) {
  try {
    // First, try to get user from middleware header
    const userHeader = request.headers.get('x-user');
    
    if (userHeader) {
      try {
        const user = JSON.parse(userHeader);
        // Verify user still exists in database
        const dbUser = await getUserById(user.id);
        
        if (!dbUser) {
          return NextResponse.json(
            { success: false, message: 'User not found' },
            { status: 401 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: { user: dbUser }
        });
      } catch (parseError) {
        console.error('Error parsing user header:', parseError);
      }
    }

    // If no header, try to verify token directly
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // Also check cookies
      const cookieHeader = request.headers.get('cookie');
      const authCookie = cookieHeader?.split(';').find(c => c.trim().startsWith('auth_token='));
      const tokenFromCookie = authCookie?.split('=')[1];
      
      if (!tokenFromCookie) {
        return NextResponse.json(
          { success: false, message: 'Not authenticated' },
          { status: 401 }
        );
      }
      
      return verifyAndReturnUser(tokenFromCookie);
    }

    return verifyAndReturnUser(token);
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { success: false, message: 'Authentication failed' },
      { status: 401 }
    );
  }
}

async function verifyAndReturnUser(token) {
  try {
    const decoded = verifyToken(token);
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid token' },
      { status: 401 }
    );
  }
}