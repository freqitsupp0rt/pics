import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { site_ids } = body;
    
    if (!site_ids || !Array.isArray(site_ids) || site_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid site_ids" },
        { status: 400 }
      );
    }
    
    // Create placeholders for the query
    const placeholders = site_ids.map(() => '?').join(',');
    
    await pool.query(
      `DELETE FROM pics_blackouts WHERE site_id IN (${placeholders})`,
      site_ids
    );
    
    return NextResponse.json({
      success: true,
      message: "Events deleted successfully"
    });
  } catch (error) {
    console.error("Error bulk deleting events:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete events" },
      { status: 500 }
    );
  }
}