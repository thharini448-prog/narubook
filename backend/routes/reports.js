const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Submit a Content Report (Abuse Detection)
router.post('/', authenticateToken, async (req, res) => {
  const { post_id, comment_id, reason } = req.body;
  const reporterId = req.user.id;

  const validReasons = ['harassment', 'hate_speech', 'nsfw', 'spam', 'copyright'];

  if (!reason || !validReasons.includes(reason)) {
    return res.status(400).json({ error: `Please provide a valid report reason. Must be one of: ${validReasons.join(', ')}` });
  }

  if (!post_id && !comment_id) {
    return res.status(400).json({ error: 'Please specify a post_id or comment_id to report.' });
  }

  try {
    // Check if post or comment exists
    if (post_id) {
      const checkPost = await db.query('SELECT * FROM posts WHERE id = $1', [post_id]);
      if (checkPost.rowCount === 0) {
        return res.status(404).json({ error: 'The reported post does not exist.' });
      }
    } else {
      const checkComment = await db.query('SELECT * FROM comments WHERE id = $1', [comment_id]);
      if (checkComment.rowCount === 0) {
        return res.status(404).json({ error: 'The reported comment does not exist.' });
      }
    }

    // Submit Report
    const insertResult = await db.query(
      'INSERT INTO reports (reporter_id, post_id, comment_id, reason, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [reporterId, post_id || null, comment_id || null, reason, 'pending']
    );

    // Increment API hit count
    await db.query('UPDATE system_metrics SET api_requests = api_requests + 1');

    res.status(201).json({
      message: 'Thank you for your report. Content has been queued for administrator review.',
      report: insertResult.rows[0]
    });
  } catch (err) {
    console.error('Submit Report API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred during report submission.' });
  }
});

module.exports = router;
