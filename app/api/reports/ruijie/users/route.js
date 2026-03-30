import { NextResponse } from 'next/server';
import axios from 'axios';
import { getRuijieToken } from "@/lib/getToken";

export async function POST(request) {
  let accountNumber = 1; 
  try {
    const body = await request.json();
    accountNumber = parseInt(body.accountNumber || 1);
    const { startDate, endDate, groupId, type = 'day' } = body;

    if (!startDate || !endDate || !groupId) {
      return NextResponse.json(
        { success: false, code: 400, msg: 'Missing required fields', accountNumber },
        { status: 400 }
      );
    }

    const ruijieToken = await getRuijieToken(accountNumber);

    const response = await axios.post(
      `https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/sta/building/sta_users?access_token=${ruijieToken}`,
      {
        startDate: String(startDate),
        endDate: String(endDate),
        groupId: String(groupId),
        type: type
      },
      { timeout: 15000 }
    );

    return NextResponse.json({
      success: true,
      accountNumber,
      data: response.data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`Users Report Error (Account ${accountNumber}):`, error.message);
    
    const errorCode = error.response?.status || 500;
    return NextResponse.json(
      { 
        success: false,
        code: errorCode,
        msg: error.response?.data?.msg || error.message,
        accountNumber
      },
      { status: errorCode }
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    groupId: searchParams.get('groupId'),
    type: searchParams.get('type') || 'day',
    accountNumber: searchParams.get('accountNumber') || '1'
  };
  return POST({ json: async () => params });
}