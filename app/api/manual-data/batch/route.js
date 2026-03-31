import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import Papa from 'papaparse';
import { pool } from '@/lib/db'; // Import from your existing db.js

function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Helper function to validate IDs
function validateIds(ids) {
  if (!Array.isArray(ids)) return false;
  return ids.every(id => {
    const num = parseInt(id);
    return !isNaN(num) && num > 0;
  });
}

// POST: Batch import from CSV or JSON
export async function POST(request) {
  let connection;
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle CSV file upload
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      
      const csvText = await file.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value, field) => {
          if (field === 'date') return value;
          if (['total_users', 'active_users'].includes(field)) return parseInt(value) || 0;
          if (['download_bytes', 'upload_bytes'].includes(field)) return parseInt(value) || 0;
          return value;
        }
      });
      
      if (parsed.errors.length > 0) {
        return NextResponse.json(
          { error: 'CSV parsing failed', details: parsed.errors },
          { status: 400 }
        );
      }
      
      const records = parsed.data.map(record => ({
        ...record,
        created_by: user.username || user.email
      }));
      
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      const results = [];
      const errors = [];
      
      for (const record of records) {
        try {
          // Validate required fields
          if (!record.site_id || !record.date) {
            errors.push({
              record,
              error: 'Missing site_id or date'
            });
            continue;
          }
          
          // Format date if needed
          let formattedDate = record.date;
          if (record.date.includes('/')) {
            const dateParts = record.date.split('/');
            if (dateParts.length === 3) {
              const month = dateParts[0].padStart(2, '0');
              const day = dateParts[1].padStart(2, '0');
              const year = dateParts[2];
              formattedDate = `${year}-${month}-${day}`;
            }
          }
          
          const [result] = await connection.execute(
            `INSERT INTO manual_data_pics (
              site_id, date, data_type, total_users, active_users,
              download_bytes, upload_bytes, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              total_users = VALUES(total_users),
              active_users = VALUES(active_users),
              download_bytes = VALUES(download_bytes),
              upload_bytes = VALUES(upload_bytes),
              notes = VALUES(notes),
              created_by = VALUES(created_by),
              updated_at = CURRENT_TIMESTAMP`,
            [
              record.site_id,
              formattedDate,
              record.data_type || 'users',
              record.total_users || 0,
              record.active_users || 0,
              record.download_bytes || 0,
              record.upload_bytes || 0,
              record.notes || '',
              user.username || user.email
            ]
          );
          
          results.push({
            id: result.insertId,
            site_id: record.site_id,
            date: formattedDate,
            status: result.affectedRows === 1 ? 'inserted' : 'updated'
          });
          
        } catch (error) {
          errors.push({
            record,
            error: error.message
          });
        }
      }
      
      if (errors.length > 0 && results.length === 0) {
        await connection.rollback();
        return NextResponse.json(
          { 
            error: 'All records failed to process',
            details: errors 
          },
          { status: 400 }
        );
      }
      
      await connection.commit();
      
      return NextResponse.json({
        success: true,
        message: `Processed ${results.length} records successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        results,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } else {
      // Handle JSON batch
      const { data } = await request.json();
      
      if (!Array.isArray(data)) {
        return NextResponse.json(
          { error: 'Data must be an array' },
          { status: 400 }
        );
      }
      
      // Validate all records
      for (const record of data) {
        if (!record.site_id || !record.date) {
          return NextResponse.json(
            { error: 'Each record must have site_id and date' },
            { status: 400 }
          );
        }
      }
      
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      const results = [];
      const errors = [];
      
      for (const record of data) {
        try {
          // Format date if needed
          let formattedDate = record.date;
          if (record.date.includes('/')) {
            const dateParts = record.date.split('/');
            if (dateParts.length === 3) {
              const month = dateParts[0].padStart(2, '0');
              const day = dateParts[1].padStart(2, '0');
              const year = dateParts[2];
              formattedDate = `${year}-${month}-${day}`;
            }
          }
          
          const [result] = await connection.execute(
            `INSERT INTO manual_data_pics (
              site_id, date, data_type, total_users, active_users,
              download_bytes, upload_bytes, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              total_users = VALUES(total_users),
              active_users = VALUES(active_users),
              download_bytes = VALUES(download_bytes),
              upload_bytes = VALUES(upload_bytes),
              notes = VALUES(notes),
              created_by = VALUES(created_by),
              updated_at = CURRENT_TIMESTAMP`,
            [
              record.site_id,
              formattedDate,
              record.data_type || 'users',
              record.total_users || 0,
              record.active_users || 0,
              record.download_bytes || 0,
              record.upload_bytes || 0,
              record.notes || '',
              user.username || user.email
            ]
          );
          
          results.push({
            id: result.insertId || 'existing',
            site_id: record.site_id,
            date: formattedDate,
            data_type: record.data_type || 'users',
            affectedRows: result.affectedRows,
            status: result.affectedRows === 1 ? 'inserted' : 'updated'
          });
          
        } catch (error) {
          errors.push({
            record,
            error: error.message
          });
        }
      }
      
      if (errors.length > 0 && results.length === 0) {
        await connection.rollback();
        return NextResponse.json(
          { 
            error: 'All records failed to process',
            details: errors 
          },
          { status: 400 }
        );
      }
      
      await connection.commit();
      
      return NextResponse.json({
        success: true,
        message: `Batch operation completed: ${results.length} records processed${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        data: results,
        errors: errors.length > 0 ? errors : undefined
      });
    }
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Batch operation error:', error);
    
    return NextResponse.json(
      { error: 'Batch operation failed', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// DELETE: Batch delete records
export async function DELETE(request) {
  let connection;
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { ids } = await request.json();
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No IDs provided for deletion' },
        { status: 400 }
      );
    }
    
    // Validate all IDs are valid numbers
    const validIds = ids.filter(id => {
      const num = parseInt(id);
      return !isNaN(num) && num > 0;
    });
    
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid IDs provided' },
        { status: 400 }
      );
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Create placeholders for SQL query
      const placeholders = validIds.map(() => '?').join(',');
      
      // First, get the records for audit purposes
      const [records] = await connection.execute(
        `SELECT id, site_id, date, data_type FROM manual_data_pics 
         WHERE id IN (${placeholders})`,
        validIds
      );
      
      // Delete the records
      const [result] = await connection.execute(
        `DELETE FROM manual_data_pics WHERE id IN (${placeholders})`,
        validIds
      );
      
      await connection.commit();
      
      return NextResponse.json({
        success: true,
        deletedCount: result.affectedRows,
        message: `Successfully deleted ${result.affectedRows} record${result.affectedRows !== 1 ? 's' : ''}`,
        deletedRecords: records
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Batch delete error:', error);
    
    return NextResponse.json(
      { 
        error: 'Batch delete failed', 
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// Optional: GET method to fetch multiple records by IDs
export async function GET(request) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids');
    
    if (!ids) {
      return NextResponse.json(
        { error: 'No IDs provided' },
        { status: 400 }
      );
    }
    
    const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (idArray.length === 0) {
      return NextResponse.json(
        { error: 'No valid IDs provided' },
        { status: 400 }
      );
    }
    
    const placeholders = idArray.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT * FROM manual_data_pics WHERE id IN (${placeholders}) ORDER BY date DESC`,
      idArray
    );
    
    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });
    
  } catch (error) {
    console.error('Batch GET error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch records', details: error.message },
      { status: 500 }
    );
  }
}