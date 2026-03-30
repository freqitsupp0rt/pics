import { NextResponse } from "next/server";
import { getHuaweiToken } from "@/lib/getToken";

export async function GET() {
  try {
    const token = await getHuaweiToken();
    return NextResponse.json({ token }, { status: 200 });
  } catch (err) {
    console.error("Huawei token error:", err);
    return NextResponse.json(
      { error: "Failed to fetch token" },
      { status: 500 }
    );
  }
}