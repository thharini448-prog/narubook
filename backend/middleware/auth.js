const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'narubook_super_secret_neon_key_2026';

// Middleware to verify if a request is authenticated
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is missing or invalid' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Increment api request metric for system monitoring
    await db.query('UPDATE system_metrics SET api_requests = api_requests + 1');

    // Check current user status in database to enforce blocks/suspensions
    const userQuery = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    
    if (userQuery.rowCount === 0) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const user = userQuery.rows[0];
    
    if (user.status === 'blocked' || user.status === 'suspended') {
      return res.status(403).json({ 
        error: `Your account is currently ${user.status}. Access is restricted.`,
        status: user.status 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth Middleware Token Verification Error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }
};

// Middleware to verify if the authenticated user is an administrator
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin
};
