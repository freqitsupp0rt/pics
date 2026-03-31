import { NextResponse } from 'next/server';
import axios from 'axios';
import { getRuijieToken } from "@/lib/getToken";

// Helper function to extract account number from vendor name
function extractRuijieAccountNumber(vendor) {
  if (!vendor) return 1; // Default to account 1
  
  const vendorLower = vendor.toLowerCase();
  
  if (vendorLower.includes('ruijie 2') || vendorLower.includes('ruijie2')) {
    return 2;
  } else if (vendorLower.includes('ruijie 1') || vendorLower.includes('ruijie1')) {
    return 1;
  } else if (vendorLower.includes('ruijie')) {
    // Try to extract account number from vendor string
    const match = vendor.match(/Ruijie\s*(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  }
  
  return 1; // Default to account 1
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { sn, startDate, endDate, vendor } = body;

    if (!sn) {
      return NextResponse.json(
        { error: 'Serial number is required' },
        { status: 400 }
      );
    }

    // Determine which Ruijie account to use based on vendor
    const accountNumber = extractRuijieAccountNumber(vendor);
    
    // Get token for the specified account
    const ruijieToken = await getRuijieToken(accountNumber);

    console.log(`Fetching performance data for ${sn} (Ruijie Account ${accountNumber})`);

    const response = await axios.post(
      'https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/flow/show/hour',
      {
        sn,
        startDate,
        endDate
      },
      {
        params: { access_token: ruijieToken },
        timeout: 15000
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data,
      vendor: `Ruijie ${accountNumber}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Ruijie Performance API error:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch Ruijie performance data',
        details: error.response?.data?.msg || error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sn = searchParams.get('sn');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendor = searchParams.get('vendor');

    if (!sn) {
      return NextResponse.json(
        { error: 'Serial number is required' },
        { status: 400 }
      );
    }

    // Determine which Ruijie account to use based on vendor
    const accountNumber = extractRuijieAccountNumber(vendor);
    
    // Get token for the specified account
    const ruijieToken = await getRuijieToken(accountNumber);

    console.log(`Fetching performance data for ${sn} (Ruijie Account ${accountNumber})`);

    const response = await axios.post(
      'https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/flow/show/hour',
      {
        sn,
        startDate,
        endDate
      },
      {
        params: { access_token: ruijieToken },
        timeout: 15000
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data,
      vendor: `Ruijie ${accountNumber}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Ruijie Performance API error:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch Ruijie performance data',
        details: error.response?.data?.msg || error.message 
      },
      { status: 500 }
    );
  }
}