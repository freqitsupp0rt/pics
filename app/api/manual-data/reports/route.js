import { NextResponse } from 'next/server';
import { pool } from '@/lib/db.js';

// POST: Fetch manual data for specific site and date range
export async function POST(request) {
  try {
    const { siteId, startDate, endDate } = await request.json();
    
    if (!siteId) {
      return NextResponse.json(
        { error: 'siteId is required' },
        { status: 400 }
      );
    }
    
    console.log('Fetching manual data for:', { siteId, startDate, endDate });
    
    // Convert timestamps to YYYY-MM-DD format for MySQL
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startFormatted = start.toISOString().split('T')[0]; // YYYY-MM-DD
    const endFormatted = end.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log('Date range for query:', startFormatted, 'to', endFormatted);
    
    const query = `
      SELECT 
        id,
        site_id,
        DATE_FORMAT(date, '%Y%m%d') as date_key,
        date,
        data_type,
        total_users,
        active_users,
        download_bytes,
        upload_bytes
      FROM manual_data_pics 
      WHERE site_id = ? 
        AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `;
    
    console.log('Executing query with params:', [siteId, startFormatted, endFormatted]);
    
    const [rows] = await pool.execute(query, [siteId, startFormatted, endFormatted]);
    
    console.log('Manual data found:', rows.length, 'rows');
    
    return NextResponse.json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('Fetch manual data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manual data', details: error.message },
      { status: 500 }
    );
  }
}