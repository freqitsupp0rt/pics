import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    
    let query = `
      SELECT id, site_id, event, start, end, vendor, image, created_at 
      FROM pics_blackouts 
      WHERE 1=1
    `;
    
    const params = [];
    
    if (siteId) {
      query += ` AND site_id = ?`;
      params.push(siteId);
    }
    
    if (start && end) {
      query += ` AND (
        (start BETWEEN ? AND ?) OR 
        (end BETWEEN ? AND ?) OR 
        (start <= ? AND end >= ?)
      )`;
      params.push(
        new Date(start),
        new Date(end),
        new Date(start),
        new Date(end),
        new Date(start),
        new Date(end)
      );
    }
    
    query += " ORDER BY start DESC";
    
    const [rows] = await pool.query(query, params);
    
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