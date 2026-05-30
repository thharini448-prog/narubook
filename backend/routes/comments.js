const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Get Comments for a specific Post (enriched with profile avatars & nested groupings)
router.get('/:postId', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.postId);

  try {
    const commentsQuery = await db.query(
      'SELECT c.*, u.username, pr.avatar_url FROM comments c JOIN users u ON c.user_id = u.id JOIN profiles pr ON c.user_id = pr.user_id WHERE c.post_id = $1 ORDER BY c.created_at ASC',
      [postId]
    );

    // Form tree structure for nested replies:
    // Root level comments will have parent_id: null. Child comments map to their parents.
    const commentsList = commentsQuery.rows;
    const commentMap = {};
    const rootComments = [];

    commentsList.forEach(c => {
      c.replies = [];
      commentMap[c.id] = c;
    });

    commentsList.forEach(c => {
      if (c.parent_id) {
        const parent = commentMap[c.parent_id];
        if (parent) {
          parent.replies.push(c);
        } else {
          // If parent not found (e.g. parent deleted), push to root or ignore
          rootComments.push(c);
        }
      } else {
        rootComments.push(c);
      }
    });

    res.json(rootComments);
  } catch (err) {
    console.error('Fetch Comments API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred fetching comments.' });
  }
});

// 2. Add Comment (supports root comments and nested replies by passing parent_id)
router.post('/:postId', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const userId = req.user.id;
  const { content, parent_id = null } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty.' });
  }

  try {
    // Check if post exists
    const postCheck = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Post does not exist.' });
    }

    // Insert Comment
    const insertResult = await db.query(
      'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [postId, userId, content.trim(), parent_id ? parseInt(parent_id) : null]
    );

    const newComment = insertResult.rows[0];

    // Grab details to render instantly
    const userQuery = await db.query(
      'SELECT u.username, pr.avatar_url FROM users u JOIN profiles pr ON u.id = pr.user_id WHERE u.id = $1',
      [userId]
    );

    res.status(201).json({
      message: 'Comment posted successfully!',
      comment: {
        ...newComment,
        username: userQuery.rows[0].username,
        avatar_url: userQuery.rows[0].avatar_url,
        replies: []
      }
    });
  } catch (err) {
    console.error('Create Comment API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred posting comment.' });
  }
});

// 3. Edit Comment (requires ownership of the comment)
router.put('/:commentId', authenticateToken, async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  const userId = req.user.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty.' });
  }

  try {
    // Find comment
    const commentQuery = await db.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (commentQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    const comment = commentQuery.rows[0];

    // Enforce ownership
    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied. You can only edit your own comments.' });
    }

    // Update
    const updateResult = await db.query(
      'UPDATE comments SET content = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [content.trim(), commentId, userId]
    );

    res.json({
      message: 'Comment updated successfully!',
      comment: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Edit Comment API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred editing comment.' });
  }
});

// 4. Delete Comment (requires comment ownership or Administrator role)
router.delete('/:commentId', authenticateToken, async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Find comment
    const commentQuery = await db.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (commentQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    const comment = commentQuery.rows[0];

    // Enforce permissions: author or admin
    if (comment.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You do not have permission to delete this comment.' });
    }

    // Delete comment (cascade deletes replies due to foreign keys)
    await db.query('DELETE FROM comments WHERE id = $1', [commentId]);

    // Log admin actions
    if (comment.user_id !== userId && userRole === 'admin') {
      await db.query(
        'INSERT INTO moderation_logs (admin_id, action, target_id, details) VALUES ($1, $2, $3, $4)',
        [userId, 'delete_comment', commentId, `Admin deleted comment by user ID ${comment.user_id} containing: "${comment.content.substring(0, 40)}"`]
      );
    }

    res.json({ message: 'Comment deleted successfully.' });
  } catch (err) {
    console.error('Delete Comment API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred deleting comment.' });
  }
});

module.exports = router;
