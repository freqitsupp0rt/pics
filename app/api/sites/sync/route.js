import { NextResponse } from "next/server";
import { fetchAndUpsertSites } from "@/lib/syncSites.js";
import { verifyToken } from "@/lib/jwt.js";

export async function GET(req) {
  try {
    let token = req.headers.get('authorization')?.replace('Bearer ', '');
    
    // Check query param if no header
    if (!token) {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    }

    if (!token) return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });

    // Verify JWT - REMOVE admin check
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    // REMOVED: if (payload.role !== 'admin') return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const count = await fetchAndUpsertSites();

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${count} sites`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync sites failed:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}