const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Get Main Timeline Feed (Display newest posts first, showing metrics)
router.get('/', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    // Select all posts joined with usernames and profile details
    const postsQuery = await db.query(
      'SELECT p.*, u.username, pr.avatar_url FROM posts p JOIN users u ON p.user_id = u.id JOIN profiles pr ON p.user_id = pr.user_id ORDER BY p.created_at DESC'
    );

    const postsWithLikes = [];
    for (const post of postsQuery.rows) {
      // Query counts and reaction lists
      const likesCheck = await db.query('SELECT reaction_type, user_id FROM likes WHERE post_id = $1', [post.id]);
      const myLike = await db.query('SELECT reaction_type FROM likes WHERE post_id = $1 AND user_id = $2', [post.id, currentUserId]);
      const commentsCheck = await db.query('SELECT id FROM comments WHERE post_id = $1', [post.id]);

      // Collect counts
      const reactionsSummary = likesCheck.rows.reduce((acc, curr) => {
        acc[curr.reaction_type] = (acc[curr.reaction_type] || 0) + 1;
        return acc;
      }, {});

      postsWithLikes.push({
        ...post,
        likes_count: likesCheck.rowCount,
        comments_count: commentsCheck.rowCount,
        user_has_liked: myLike.rowCount > 0,
        my_reaction: myLike.rowCount > 0 ? myLike.rows[0].reaction_type : null,
        reactions_breakdown: reactionsSummary
      });
    }

    res.json(postsWithLikes);
  } catch (err) {
    console.error('Fetch Timeline API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred fetching timeline feed.' });
  }
});

// 2. Create Post (Auto-parses tags from hashtags inside post content!)
router.post('/', authenticateToken, async (req, res) => {
  const { content, media_url, media_type } = req.body;
  const userId = req.user.id;

  if (!content && !media_url) {
    return res.status(400).json({ error: 'Post must contain either text content or a media attachment.' });
  }

  try {
    // Auto-parse hashtags from the content string (e.g. #Naruto #Luffy -> ['Naruto', 'Luffy'])
    const hashtags = [];
    if (content) {
      const tagRegex = /#(\w+)/g;
      let match;
      while ((match = tagRegex.exec(content)) !== null) {
        hashtags.push(match[1]);
      }
    }

    const typeOfMedia = media_url ? (media_type || 'image') : 'text';

    const insertResult = await db.query(
      'INSERT INTO posts (user_id, content, media_url, media_type, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, content, media_url || '', typeOfMedia, hashtags]
    );

    const newPost = insertResult.rows[0];

    // Fetch details to return fully enriched object
    const userQuery = await db.query(
      'SELECT u.username, pr.avatar_url FROM users u JOIN profiles pr ON u.id = pr.user_id WHERE u.id = $1',
      [userId]
    );

    res.status(201).json({
      message: 'Post published successfully!',
      post: {
        ...newPost,
        username: userQuery.rows[0].username,
        avatar_url: userQuery.rows[0].avatar_url,
        likes_count: 0,
        comments_count: 0,
        user_has_liked: false,
        my_reaction: null,
        reactions_breakdown: {}
      }
    });
  } catch (err) {
    console.error('Create Post API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred publishing post.' });
  }
});

// 3. Delete Post (Requires ownership or Administrator role)
router.delete('/:postId', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Find post
    const postQuery = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const post = postQuery.rows[0];

    // Verify permission: author or admin
    if (post.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You do not have permission to delete this post.' });
    }

    // Delete post
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);

    // Log admin intervention if deleted by moderator
    if (post.user_id !== userId && userRole === 'admin') {
      await db.query(
        'INSERT INTO moderation_logs (admin_id, action, target_id, details) VALUES ($1, $2, $3, $4)',
        [userId, 'delete_post', postId, `Admin deleted post containing: "${post.content ? post.content.substring(0, 40) : 'media'}" by user ID ${post.user_id}`]
      );
    }

    res.json({ message: 'Post and its associated data deleted successfully.' });
  } catch (err) {
    console.error('Delete Post API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred deleting post.' });
  }
});

// 4. Toggle Post Reaction / Like Button (Supports toggle behavior: same reaction = unlike, new reaction = updates it)
router.post('/:postId/like', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const userId = req.user.id;
  const { reaction = 'like' } = req.body; // reactions: 'like', 'heart', 'fire', 'wow'

  try {
    // Check if post exists
    const postCheck = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Post does not exist.' });
    }

    // Check if reaction already exists
    const existingLike = await db.query(
      'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existingLike.rowCount > 0) {
      const currentReaction = existingLike.rows[0].reaction_type;
      
      if (currentReaction === reaction) {
        // Toggle off - UNLIKE
        await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        
        // Fetch updated counts
        const countQuery = await db.query('SELECT reaction_type FROM likes WHERE post_id = $1', [postId]);
        const breakdown = countQuery.rows.reduce((acc, curr) => {
          acc[curr.reaction_type] = (acc[curr.reaction_type] || 0) + 1;
          return acc;
        }, {});

        return res.json({
          message: 'Reaction removed.',
          user_has_liked: false,
          likes_count: countQuery.rowCount,
          reactions_breakdown: breakdown
        });
      } else {
        // Update reaction type
        await db.query(
          'UPDATE likes SET reaction_type = $1 WHERE user_id = $2 AND post_id = $3',
          [reaction, userId, postId]
        );

        // Fetch updated counts
        const countQuery = await db.query('SELECT reaction_type FROM likes WHERE post_id = $1', [postId]);
        const breakdown = countQuery.rows.reduce((acc, curr) => {
          acc[curr.reaction_type] = (acc[curr.reaction_type] || 0) + 1;
          return acc;
        }, {});

        return res.json({
          message: `Reaction updated to ${reaction}!`,
          user_has_liked: true,
          likes_count: countQuery.rowCount,
          reactions_breakdown: breakdown
        });
      }
    } else {
      // First click - LIKE / REACT
      await db.query(
        'INSERT INTO likes (user_id, post_id, reaction_type) VALUES ($1, $2, $3)',
        [userId, postId, reaction]
      );

      // Fetch updated counts
      const countQuery = await db.query('SELECT reaction_type FROM likes WHERE post_id = $1', [postId]);
      const breakdown = countQuery.rows.reduce((acc, curr) => {
        acc[curr.reaction_type] = (acc[curr.reaction_type] || 0) + 1;
        return acc;
      }, {});

      return res.json({
        message: `Reacted with ${reaction}!`,
        user_has_liked: true,
        likes_count: countQuery.rowCount,
        reactions_breakdown: breakdown
      });
    }
  } catch (err) {
    console.error('Like API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred toggling post reaction.' });
  }
});

module.exports = router;
