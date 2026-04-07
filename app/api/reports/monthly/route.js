import { NextResponse } from 'next/server';
import { pool } from "@/lib/db.js";
import dayjs from "dayjs";

/**
 * GET: Fetch saved reports list or a specific report by ID
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const id = searchParams.get('id');
    const excludePdf = searchParams.get('excludePdf') === 'true';
    const excludeConfig = searchParams.get('excludeConfig') === 'true';

    // If an ID is provided, fetch the specific report including its config
    if (id) {
      let fields = '*';
      if (excludePdf && !excludeConfig) fields = 'id, site_id, report_date, config, created_at';
      else if (!excludePdf && excludeConfig) fields = 'id, site_id, report_date, pdf_data, created_at';
      else if (excludePdf && excludeConfig) fields = 'id, site_id, report_date, created_at';

      const query = `SELECT ${fields} FROM monthly_reports WHERE id = ?`;
      const [rows] = await pool.execute(
        query,
        [id]
      );
      if (rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Report not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: rows[0] });
    }

    // Otherwise, fetch the list of reports for a site
    if (!siteId) {
      return NextResponse.json({ success: false, message: 'Site ID is required' }, { status: 400 });
    }

    const [rows] = await pool.execute(
      'SELECT id, report_date, created_at FROM monthly_reports WHERE site_id = ? ORDER BY report_date DESC',
      [siteId]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error in monthly reports API:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Save a new report and its configuration
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { siteId, reportDate, pdfData, config } = body;

    if (!siteId || !reportDate || !pdfData) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields (siteId, reportDate, or pdfData)' 
      }, { status: 400 });
    }

    // Convert config object to JSON string for storage
    const configJson = JSON.stringify(config || {});

    const [result] = await pool.execute(
      'INSERT INTO monthly_reports (site_id, report_date, pdf_data, config) VALUES (?, ?, ?, ?)',
      [siteId, reportDate, pdfData, configJson]
    );

    // Automatically flag images used in this report
    if (config.imageIds) {
      const usedIds = [];
      if (config.imageIds.combox) usedIds.push(config.imageIds.combox);
      if (config.imageIds.inspection) usedIds.push(config.imageIds.inspection);
      if (config.imageIds.additional) usedIds.push(...config.imageIds.additional);
      if (config.imageIds.speedtest) usedIds.push(...config.imageIds.speedtest);

      const uniqueIds = [...new Set(usedIds.filter(Boolean))];

      if (uniqueIds.length > 0) {
        const reportMonth = dayjs(reportDate).format('MMMM YYYY');
        await pool.query(
          `UPDATE site_images 
           SET is_mir = 1, description = CONCAT(IFNULL(description, ''), ' [Used in ${reportMonth} MIR]') 
           WHERE id IN (?)`,
          [uniqueIds]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Report saved successfully',
      data: {
        id: result.insertId,
        reportDate,
        siteId
      }
    });
  } catch (error) {
    console.error('Error saving monthly report:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}