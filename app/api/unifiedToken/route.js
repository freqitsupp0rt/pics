import { NextResponse } from "next/server";
import { getRuijieToken, checkTokenStatus } from "@/lib/getToken";

export async function GET() {
  try {
    console.log('Testing Ruijie tokens...');
    
    // Test Account 1
    let token1 = null;
    try {
      token1 = await getRuijieToken(1);
    } catch (error) {
      console.error('Account 1 error:', error.message);
    }
    
    // Test Account 2
    let token2 = null;
    try {
      token2 = await getRuijieToken(2);
    } catch (error) {
      console.error('Account 2 error:', error.message);
    }
    
    const status = checkTokenStatus();
    
    return NextResponse.json({
      success: true,
      account1: {
        hasToken: !!token1,
        tokenLength: token1 ? token1.length : 0,
        first10: token1 ? token1.substring(0, 10) + '...' : null
      },
      account2: {
        hasToken: !!token2,
        tokenLength: token2 ? token2.length : 0,
        first10: token2 || null
      },
      status,
      areTokensDifferent: token1 && token2 ? token1 !== token2 : 'N/A'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}