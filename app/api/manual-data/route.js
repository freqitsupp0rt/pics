import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Helper: Get user from token
function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

// Helper: Validate data
function validateManualData(data, isUpdate = false) {
  const errors = [];
  
  if (!isUpdate) {
    if (!data.site_id) errors.push('site_id is required');
    if (!data.date) errors.push('date is required');
    if (!data.data_type) errors.push('data_type is required');
  }
  
  if (data.date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
  }
  
  if (data.data_type && !['users', 'traffic'].includes(data.data_type)) {
    errors.push('data_type must be either "users" or "traffic"');
  }
  
  if (data.total_users !== undefined && (isNaN(data.total_users) || data.total_users < 0)) {
    errors.push('total_users must be a non-negative number');
  }
  
  if (data.active_users !== undefined && (isNaN(data.active_users) || data.active_users < 0)) {
    errors.push('active_users must be a non-negative number');
  }
  
  if (data.download_bytes !== undefined && (isNaN(data.download_bytes) || data.download_bytes < 0)) {
    errors.push('download_bytes must be a non-negative number');
  }
  
  if (data.upload_bytes !== undefined && (isNaN(data.upload_bytes) || data.upload_bytes < 0)) {
    errors.push('upload_bytes must be a non-negative number');
  }
  
  return errors;
}

// GET: Fetch manual data with filters
export async function GET(request) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const dataType = searchParams.get('dataType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    // Build query
    let query = 'SELECT * FROM manual_data_pics WHERE 1=1';
    const params = [];
    
    if (siteId) {
      query += ' AND site_id = ?';
      params.push(siteId);
    }
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    if (dataType && dataType !== 'all') {
      query += ' AND data_type = ?';
      params.push(dataType);
    }
    
    // Add ordering
    query += ' ORDER BY date DESC, site_id, data_type';
    
    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    // Execute query
    const [rows] = await pool.execute(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM manual_data_pics WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit and offset
    
    if (siteId) countQuery += ' AND site_id = ?';
    if (startDate) countQuery += ' AND date >= ?';
    if (endDate) countQuery += ' AND date <= ?';
    if (dataType && dataType !== 'all') countQuery += ' AND data_type = ?';
    
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    
    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('GET manual-data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manual data', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new manual data
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
    
    const data = await request.json();
    
    // Validate single data or array
    const isArray = Array.isArray(data);
    const dataToValidate = isArray ? data : [data];
    
    // Validate all items
    for (const item of dataToValidate) {
      const errors = validateManualData(item);
      if (errors.length > 0) {
        return NextResponse.json(
          { error: 'Validation failed', details: errors },
          { status: 400 }
        );
      }
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const results = [];
    
    for (const item of dataToValidate) {
      const {
        site_id,
        date,
        data_type,
        total_users = 0,
        active_users = 0,
        download_bytes = 0,
        upload_bytes = 0,
        notes = ''
      } = item;
      
      // Check if entry already exists
      const [existing] = await connection.execute(
        'SELECT id FROM manual_data_pics WHERE site_id = ? AND date = ? AND data_type = ?',
        [site_id, date, data_type]
      );
      
      let result;
      if (existing.length > 0) {
        // Update existing
        await connection.execute(
          `UPDATE manual_data_pics SET 
            total_users = ?,
            active_users = ?,
            download_bytes = ?,
            upload_bytes = ?,
            notes = ?,
            created_by = ?
          WHERE id = ?`,
          [
            total_users,
            active_users,
            download_bytes,
            upload_bytes,
            notes,
            user.username || user.email,
            existing[0].id
          ]
        );
        result = { ...item, id: existing[0].id, updated: true };
      } else {
        // Insert new
        const [insertResult] = await connection.execute(
          `INSERT INTO manual_data_pics (
            site_id, date, data_type, total_users, active_users,
            download_bytes, upload_bytes, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            site_id,
            date,
            data_type,
            total_users,
            active_users,
            download_bytes,
            upload_bytes,
            notes,
            user.username || user.email
          ]
        );
        result = { ...item, id: insertResult.insertId, inserted: true };
      }
      
      results.push(result);
    }
    
    await connection.commit();
    
    return NextResponse.json({
      success: true,
      message: isArray 
        ? `${results.length} records processed successfully`
        : 'Manual data created/updated successfully',
      data: isArray ? results : results[0]
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('POST manual-data error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Duplicate entry for site/date/type combination' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create manual data', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// PUT: Update manual data (by ID)
export async function PUT(request) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id, ...updateData } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required for update' },
        { status: 400 }
      );
    }
    
    // Validate update data
    const errors = validateManualData(updateData, true);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }
    
    // Check if record exists
    const [existing] = await pool.execute(
      'SELECT * FROM manual_data_pics WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Manual data not found' },
        { status: 404 }
      );
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateParams = [];
    
    const allowedFields = [
      'total_users', 'active_users', 'download_bytes', 
      'upload_bytes', 'notes', 'data_type', 'date', 'site_id'
    ];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateParams.push(updateData[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    
    // Add updated_by tracking
    updateFields.push('created_by = ?');
    updateParams.push(user.username || user.email);
    
    // Add WHERE condition
    updateParams.push(id);
    
    const query = `UPDATE manual_data_pics SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await pool.execute(query, updateParams);
    
    // Get updated record
    const [updated] = await pool.execute(
      'SELECT * FROM manual_data_pics WHERE id = ?',
      [id]
    );
    
    return NextResponse.json({
      success: true,
      message: 'Manual data updated successfully',
      data: updated[0]
    });
    
  } catch (error) {
    console.error('PUT manual-data error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Update would create duplicate entry for site/date/type combination' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update manual data', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Remove manual data
export async function DELETE(request) {
  try {
    const user = getUserFromToken(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required for deletion' },
        { status: 400 }
      );
    }
    
    // Check if record exists
    const [existing] = await pool.execute(
      'SELECT * FROM manual_data_pics WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Manual data not found' },
        { status: 404 }
      );
    }
    
    // Delete the record
    await pool.execute('DELETE FROM manual_data_pics WHERE id = ?', [id]);
    
    return NextResponse.json({
      success: true,
      message: 'Manual data deleted successfully'
    });
    
  } catch (error) {
    console.error('DELETE manual-data error:', error);
    return NextResponse.json(
      { error: 'Failed to delete manual data', details: error.message },
      { status: 500 }
    );
  }
}