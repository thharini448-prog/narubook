const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Get Conversation Messages between current user and another user
router.get('/:otherUserId', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = parseInt(req.params.otherUserId);

  if (isNaN(otherUserId)) {
    return res.status(400).json({ error: 'Invalid user ID parameter.' });
  }

  try {
    // Check if other user exists
    const userCheck = await db.query('SELECT id, username FROM users WHERE id = $1', [otherUserId]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Conversation user not found.' });
    }

    // Fetch message history ordered chronologically
    const messagesQuery = await db.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND recipient_id = $2) 
          OR (sender_id = $2 AND recipient_id = $1) 
       ORDER BY created_at ASC`,
      [currentUserId, otherUserId]
    );

    res.json(messagesQuery.rows);
  } catch (err) {
    console.error('Get Direct Messages API Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving direct messages history.' });
  }
});

// 2. Send Direct Text Message to another user
router.post('/', authenticateToken, async (req, res) => {
  const senderId = req.user.id;
  const { recipient_id, content } = req.body;
  const recipientId = parseInt(recipient_id);

  if (isNaN(recipientId)) {
    return res.status(400).json({ error: 'Recipient user ID is required.' });
  }

  if (senderId === recipientId) {
    return res.status(400).json({ error: 'You cannot send a direct message to yourself.' });
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  // Ensure content is strictly text, no media embeds or excessive markdown attachments
  // Simple validation to prevent base64 images or complex image link patterns if they want
  const hasImage = /!\[.*\]\(.*\)/.test(content) || /<img/i.test(content) || content.startsWith('data:image');
  if (hasImage) {
    return res.status(400).json({ error: 'Direct messages support text only. Images, videos, and media embeds are prohibited.' });
  }

  if (content.length > 2000) {
    return res.status(400).json({ error: 'Message content is too long. Maximum 2000 characters allowed.' });
  }

  try {
    // Check if recipient exists and is active
    const recipientCheck = await db.query('SELECT status FROM users WHERE id = $1', [recipientId]);
    if (recipientCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Recipient user not found.' });
    }

    if (recipientCheck.rows[0].status === 'blocked') {
      return res.status(403).json({ error: 'You cannot send messages to blocked user accounts.' });
    }

    // Insert direct message
    const insertQuery = await db.query(
      'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *',
      [senderId, recipientId, content.trim()]
    );

    const newMsg = insertQuery.rows[0];

    // Enrich the response with sender details for UI updates
    const senderProfile = await db.query('SELECT avatar_url FROM profiles WHERE user_id = $1', [senderId]);
    const enrichedMsg = {
      ...newMsg,
      sender_username: req.user.username,
      sender_avatar: senderProfile.rows[0]?.avatar_url
    };

    res.status(201).json(enrichedMsg);
  } catch (err) {
    console.error('Send Direct Message API Error:', err.message);
    res.status(500).json({ error: 'Server error sending direct message.' });
  }
});

module.exports = router;
