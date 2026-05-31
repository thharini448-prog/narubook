const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'narubook_super_secret_neon_key_2026';

// 1. Signup Route
router.post('/signup', async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'All fields (email, username, password) are required.' });
  }

  try {
    // Check if email already exists
    const userExist = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExist.rowCount > 0) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // Check if username already exists (Instagram-style uniqueness check)
    const usernameExist = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (usernameExist.rowCount > 0) {
      return res.status(400).json({ error: 'This username is already taken. Please choose a different one.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Auto-promote madaeshm@gmail.com to Admin
    let role = 'user';
    if (email.trim().toLowerCase() === 'madaeshm@gmail.com') {
      role = 'admin';
    }

    // Insert user into DB
    const insertResult = await db.query(
      'INSERT INTO users (email, password_hash, username, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, role, status',
      [email.trim().toLowerCase(), passwordHash, username.trim(), role, 'active']
    );

    const newUser = insertResult.rows[0];

    // Ensure profile exists in both Local Mock and live Supabase PostgreSQL databases
    let profileQuery = await db.query('SELECT * FROM profiles WHERE user_id = $1', [newUser.id]);
    if (profileQuery.rowCount === 0) {
      await db.query(
        'INSERT INTO profiles (user_id, avatar_url, banner_url, bio, favorite_anime, fandoms, followers_count, following_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING',
        [
          newUser.id,
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
          'New NaruBook fan!',
          'None',
          [],
          0,
          0
        ]
      );
      profileQuery = await db.query('SELECT * FROM profiles WHERE user_id = $1', [newUser.id]);
    }
    const profile = profileQuery.rowCount > 0 ? profileQuery.rows[0] : null;

    // Generate JWT Session Token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, status: newUser.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`Signup successful: User "${newUser.email}" registered successfully.`);

    res.status(201).json({
      message: 'Signup successful! Welcome to NaruBook.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status
      },
      profile
    });
  } catch (err) {
    console.error('Signup API Error:', err.message, err.stack);
    res.status(500).json({ error: 'Server error occurred during signup.' });
  }
});

// 2. Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    console.error('Login error: missing email or password.');
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userQuery.rowCount === 0) {
      console.error(`Login failed: email "${email.trim().toLowerCase()}" does not exist in database.`);
      return res.status(400).json({ error: 'Invalid email address or password.' });
    }

    const user = userQuery.rows[0];

    // Validate account status
    if (user.status === 'blocked' || user.status === 'suspended') {
      console.error(`Login failed: account "${user.email}" is currently "${user.status}".`);
      return res.status(403).json({ error: `Your account has been ${user.status} by a moderator. Access is restricted.` });
    }

    // Check password
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      console.error(`Login failed: incorrect password provided for account "${user.email}".`);
      return res.status(400).json({ error: 'Invalid email address or password.' });
    }

    // Generate JWT Session Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Ensure profile exists dynamically
    let profileQuery = await db.query('SELECT * FROM profiles WHERE user_id = $1', [user.id]);
    if (profileQuery.rowCount === 0) {
      await db.query(
        'INSERT INTO profiles (user_id, avatar_url, banner_url, bio, favorite_anime, fandoms, followers_count, following_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING',
        [
          user.id,
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
          'New NaruBook fan!',
          'None',
          [],
          0,
          0
        ]
      );
      profileQuery = await db.query('SELECT * FROM profiles WHERE user_id = $1', [user.id]);
    }
    const profile = profileQuery.rowCount > 0 ? profileQuery.rows[0] : null;

    // Increment API hit count
    await db.query('UPDATE system_metrics SET api_requests = api_requests + 1');

    console.log(`Login successful: user "${user.email}" authenticated successfully. Role: "${user.role}".`);

    res.json({
      message: 'Login successful! Welcome back.',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status
      },
      profile
    });
  } catch (err) {
    console.error('Login API Error:', err.message, err.stack);
    res.status(500).json({ error: 'Server error occurred during login.' });
  }
});

// 3. Password Reset Route (Simulated out-of-the-box, updating directly for verification ease)
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  try {
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userQuery.rowCount === 0) {
      return res.status(400).json({ error: 'No account associated with this email exists.' });
    }

    // Hash new password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    // Save to Database
    await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email.trim().toLowerCase()]);

    console.log(`Password reset successful: password updated for "${email.trim().toLowerCase()}".`);

    res.json({ message: 'Password has been reset successfully! You can now log in with your new password.' });
  } catch (err) {
    console.error('Password Reset API Error:', err.message, err.stack);
    res.status(500).json({ error: 'Server error occurred during password reset.' });
  }
});

// 4. Fetch Active Session
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let profileQuery = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
    if (profileQuery.rowCount === 0) {
      await db.query(
        'INSERT INTO profiles (user_id, avatar_url, banner_url, bio, favorite_anime, fandoms, followers_count, following_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING',
        [
          req.user.id,
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
          'New NaruBook fan!',
          'None',
          [],
          0,
          0
        ]
      );
      profileQuery = await db.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
    }
    const profile = profileQuery.rowCount > 0 ? profileQuery.rows[0] : null;
    
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role,
        status: req.user.status
      },
      profile
    });
  } catch (err) {
    console.error('Get Session API Error:', err.message, err.stack);
    res.status(500).json({ error: 'Server error occurred fetching session information.' });
  }
});

module.exports = router;
