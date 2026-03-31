import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Freqitpics@2024';

// Generate JWT token
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (48 * 60 * 60) // 48 hours expiration
  };

  return jwt.sign(payload, JWT_SECRET);
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Generate refresh token
export function generateRefreshToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  };

  return jwt.sign(payload, JWT_SECRET);
}

// Authenticate user with database - ASYNC
export async function authenticateUser(username, password) {
  try {
    console.log('Authenticating user:', username);
    // Query user from pics_users table
    const [rows] = await pool.execute(
      'SELECT id, username, password_hash, name, role FROM pics_users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    console.log('User found:', rows.length > 0);

    if (rows.length === 0) {
      return null;
    }

    const user = rows[0];

    // Verify password with bcrypt
    console.log('Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      return null;
    }

    // Return user object without password
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw new Error('Authentication failed');
  }
}

// Check if token is expired
export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch (error) {
    return true;
  }
}

// Get user by ID from database (for extend session)
export async function getUserById(userId) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, name, role FROM pics_users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      id: rows[0].id,
      username: rows[0].username,
      name: rows[0].name,
      role: rows[0].role
    };
  } catch (error) {
    console.error('Get user error:', error);
    throw new Error('Failed to get user');
  }
}

// Get user by username from database (for extend session)
export async function getUserByUsername(username) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, name, role FROM pics_users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      id: rows[0].id,
      username: rows[0].username,
      name: rows[0].name,
      role: rows[0].role
    };
  } catch (error) {
    console.error('Get user error:', error);
    throw new Error('Failed to get user');
  }
}

// Create new user with hashed password
export async function createUser(userData) {
  try {
    const { username, password, name, role = 'user' } = userData;
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert into pics_users table
    const [result] = await pool.execute(
      `INSERT INTO pics_users (username, password_hash, name, role) 
       VALUES (?, ?, ?, ?)`,
      [username, password_hash, name, role]
    );

    return {
      id: result.insertId,
      username,
      name,
      role
    };
  } catch (error) {
    console.error('Create user error:', error);
    throw new Error('Failed to create user');
  }
}

// Check if user exists
export async function userExists(username) {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM pics_users WHERE username = ?',
      [username]
    );

    return rows.length > 0;
  } catch (error) {
    console.error('Check user exists error:', error);
    throw new Error('Failed to check user existence');
  }
}