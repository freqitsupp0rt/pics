import { NextResponse } from "next/server";
import { getRuijieToken } from "@/lib/getToken";
import axios from "axios";

export async function POST(req) {
  let accountNumber = 1; // Declare outside so catch block can see it
  try {
    const body = await req.json();
    accountNumber = body.accountNumber || 1;
    const { startDate, endDate, buildingId, type = 'day' } = body;

    if (!startDate || !endDate || !buildingId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ruijieToken = await getRuijieToken(accountNumber);

    const url = `https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/flow/show?access_token=${ruijieToken}`;
    
    const ruijieRes = await axios.post(url, 
      { startDate, endDate, buildingId, type },
      { timeout: 15000 }
    );

    const data = ruijieRes.data;

    if (data.code !== 0) {
      return NextResponse.json(
        { success: false, error: "Ruijie API error", details: data, accountNumber },
        { status: 500 }
      );
    }

    const formattedList = data.list?.map((item) => {
      let timeString = item.timeString || item.timeStamp || null;
      if (item.timeStamp) {
        const date = new Date(item.timeStamp);
        if (!isNaN(date)) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          timeString = `${yyyy}${mm}${dd}`;
        }
      }
      return { ...item, timeString };
    }) || [];

    return NextResponse.json({
      success: true,
      accountNumber,
      data: { ...data, list: formattedList },
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    // accountNumber is now defined here
    console.error(`Traffic API Error (Account ${accountNumber}):`, err.message);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error", 
        details: err.message,
        accountNumber 
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    buildingId: searchParams.get('buildingId'),
    type: searchParams.get('type') || 'day',
    accountNumber: parseInt(searchParams.get('accountNumber') || '1')
  };
  return POST({ json: async () => params });
}