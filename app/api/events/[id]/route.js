import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    // In Next.js 15, params is a Promise - you MUST await it
    const { id } = await params; // Add await here
    
    const body = await request.json();
    const { site_id, event, start, end, vendor, image } = body;
    
    if (!site_id || !event || !start || !end) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    await pool.query(
      `UPDATE pics_blackouts 
       SET site_id = ?, event = ?, start = ?, end = ?, vendor = ?, image = ? 
       WHERE id = ?`,
      [site_id, event, start, end, vendor || null, image || null, id]
    );
    
    return NextResponse.json({
      success: true,
      message: "Event updated successfully"
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    await pool.query(`DELETE FROM pics_blackouts WHERE id = ?`, [id]);
    
    return NextResponse.json({
      success: true,
      message: "Event deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete event" },
      { status: 500 }
    );
  }
}