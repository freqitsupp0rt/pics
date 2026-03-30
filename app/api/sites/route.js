import { NextResponse } from "next/server";
import { pool } from "@/lib/db.js";

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM pics_sites ORDER BY vendor, name`
    );

    const vendorStats = {};
    rows.forEach(row => {
      if (!vendorStats[row.vendor]) vendorStats[row.vendor] = 0;
      vendorStats[row.vendor]++;
    });

    // Map rows: use vendor_site_id as id
    const data = rows.map(r => ({
      ...r,
      id: r.vendor_site_id,       // override id
      dbId: r.id,                 // keep original DB id if needed
      raw: JSON.parse(r.raw)
    }));

    return NextResponse.json({
      success: true,
      totalRecords: rows.length,
      data,
      vendorStats,
      source: "database"
    });
  } catch (error) {
    console.error("Fetch pics_sites failed:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch sites",
      details: error.message
    }, { status: 500 });
  }
}
