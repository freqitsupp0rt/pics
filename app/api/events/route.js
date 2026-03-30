import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, site_id, event, start, end, vendor, image, created_at 
       FROM pics_blackouts 
       ORDER BY start DESC`
    );
    
    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { events } = body;
    
    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: "Invalid events data" },
        { status: 400 }
      );
    }
    
    // Insert multiple events
    const insertPromises = events.map(event => {
      return pool.query(
        `INSERT INTO pics_blackouts (site_id, event, start, end, vendor, image) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          event.site_id, 
          event.event, 
          event.start, 
          event.end, 
          event.vendor || null,
          event.image || null  // Add image field
        ]
      );
    });
    
    await Promise.all(insertPromises);
    
    return NextResponse.json({
      success: true,
      message: "Events added successfully"
    });
  } catch (error) {
    console.error("Error adding events:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add events" },
      { status: 500 }
    );
  }
}