const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Fetch all notifications for the active user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const notificationsQuery = await db.query(
      'SELECT n.*, u.username AS sender_username, pr.avatar_url AS sender_avatar FROM notifications n JOIN users u ON n.sender_id = u.id JOIN profiles pr ON n.sender_id = pr.user_id WHERE n.recipient_id = $1 ORDER BY n.created_at DESC LIMIT 30',
      [userId]
    );

    res.json(notificationsQuery.rows);
  } catch (err) {
    console.error('Fetch Notifications API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred fetching notifications.' });
  }
});

// 2. Mark all notifications as read
router.post('/read', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE recipient_id = $1',
      [userId]
    );

    res.json({ message: 'Notifications cleared successfully.' });
  } catch (err) {
    console.error('Clear Notifications API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred clearing notifications.' });
  }
});

module.exports = router;
