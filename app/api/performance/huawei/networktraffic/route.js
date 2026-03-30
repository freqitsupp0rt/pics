import { NextResponse } from 'next/server';
import axios from 'axios';
import { getHuaweiToken } from "@/lib/getToken";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  // Get query parameters
  const deviceId = searchParams.get('deviceId');
  const timeRange = searchParams.get('timeRange') || '1h';
  
  if (!deviceId) {
    return NextResponse.json(
      { error: 'Device ID is required' },
      { status: 400 }
    );
  }

  try {
    // Get fresh Huawei token
    const huaweiToken = await getHuaweiToken();
    
    // Calculate time range based on selection
    const now = Math.floor(Date.now() / 1000);
    let beginTime = now - 3600; // Default 1 hour
    
    switch(timeRange) {
      case "1h":
        beginTime = now - 3600;
        break;
      case "6h":
        beginTime = now - 21600;
        break;
      case "24h":
        beginTime = now - 86400;
        break;
      case "7d":
        beginTime = now - 604800;
        break;
    }

    // Call Huawei performance API
    const response = await axios.get(
      'https://naas-intl.huaweicloud.com:18002/controller/campus/v1/performanceservice/basicperformance/networktraffic',
      {
        params: {
          mode: "device",
          id: deviceId,
          timeDimension: "day",
          beginTime: beginTime,
          endTime: now
        },
        headers: {
          "X-ACCESS-TOKEN": huaweiToken
        }
      }
    );

    // Return the Huawei API response
    return NextResponse.json(response.data);
    
  } catch (error) {
    console.error('Huawei Performance API error:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch performance data',
        details: error.response?.data || error.message,
        errcode: error.response?.data?.errcode || '500'
      },
      { status: 500 }
    );
  }
}