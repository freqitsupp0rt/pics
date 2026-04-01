import { NextResponse } from 'next/server';
import { pool } from "@/lib/db.js";

/**
 * GET: Fetch images for a specific site
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ success: false, message: 'Site ID is required' }, { status: 400 });
    }

    // Fetch images from your database
    const [rows] = await pool.execute(
      'SELECT id, image_data, description, is_mir, updated_at FROM site_images WHERE site_id = ? ORDER BY id ASC',
      [siteId]
    );

    return NextResponse.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        url: row.image_data,
        description: row.description || "",
        isMir: !!row.is_mir,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching site images:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Save or Update the entire gallery for a site
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { siteId, images } = body;

    if (!siteId || !Array.isArray(images)) {
      return NextResponse.json({ success: false, message: 'Invalid data provided' }, { status: 400 });
    }

    // Using a transaction to ensure we replace the old gallery with the new one safely
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Delete existing images for this site
      await connection.execute('DELETE FROM site_images WHERE site_id = ?', [siteId]);

      // 2. Insert the new set of images
      if (images.length > 0) {
        const insertQuery = 'INSERT INTO site_images (site_id, image_data, description, is_mir, updated_at) VALUES ?';
        const insertValues = images.map(img => [
          siteId,
          // Handle both raw strings and object structures
          typeof img === 'string' ? img : (img.url || ""),
          // Ensure description is a string and isMir is a 1 or 0
          String(img.description || ""), 
          img.isMir ? 1 : 0, 
          new Date()
        ]);
        await connection.query(insertQuery, [insertValues]);
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        message: 'Gallery saved successfully'
      });
    } catch (poolError) {
      await connection.rollback();
      connection.release();
      throw poolError;
    }
  } catch (error) {
    console.error('Error saving site images:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}