const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Get User Profile by ID (includes posts list and follow checks)
router.get('/profile/:userId', authenticateToken, async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  const currentUserId = req.user.id;

  try {
    // Get user and profile details
    const userQuery = await db.query(
      'SELECT u.id, u.username, u.email, u.role, u.status, p.avatar_url, p.banner_url, p.bio, p.favorite_anime, p.fandoms, p.followers_count, p.following_count FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.id = $1',
      [targetUserId]
    );

    if (userQuery.rowCount === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const profile = userQuery.rows[0];

    // Check if the current user is following the target user
    const followQuery = await db.query(
      'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUserId, targetUserId]
    );
    const isFollowing = followQuery.rowCount > 0;

    // Fetch this user's posts
    const postsQuery = await db.query(
      'SELECT p.*, u.username, pr.avatar_url FROM posts p JOIN users u ON p.user_id = u.id JOIN profiles pr ON p.user_id = pr.user_id WHERE p.user_id = $1 ORDER BY p.created_at DESC',
      [targetUserId]
    );

    // Map likes/comments count for each post
    const postsWithMetrics = [];
    for (const post of postsQuery.rows) {
      const likesCheck = await db.query('SELECT reaction_type FROM likes WHERE post_id = $1', [post.id]);
      const myLike = await db.query('SELECT reaction_type FROM likes WHERE post_id = $1 AND user_id = $2', [post.id, currentUserId]);
      const commentsCheck = await db.query('SELECT id FROM comments WHERE post_id = $1', [post.id]);

      postsWithMetrics.push({
        ...post,
        likes_count: likesCheck.rowCount,
        comments_count: commentsCheck.rowCount,
        user_has_liked: myLike.rowCount > 0,
        my_reaction: myLike.rowCount > 0 ? myLike.rows[0].reaction_type : null
      });
    }

    res.json({
      profile,
      isFollowing,
      posts: postsWithMetrics
    });
  } catch (err) {
    console.error('Fetch Profile API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred fetching profile details.' });
  }
});

// 2. Update User Profile (handles avatar, banner, bio, favorite anime, fandom tags)
router.put('/profile', authenticateToken, async (req, res) => {
  const { avatar_url, banner_url, bio, favorite_anime, fandoms } = req.body;
  const userId = req.user.id;

  try {
    const updateQuery = await db.query(
      'UPDATE profiles SET avatar_url = $1, banner_url = $2, bio = $3, favorite_anime = $4, fandoms = $5 WHERE user_id = $6 RETURNING *',
      [avatar_url, banner_url, bio, favorite_anime, fandoms || [], userId]
    );

    res.json({
      message: 'Profile updated successfully!',
      profile: updateQuery.rows[0]
    });
  } catch (err) {
    console.error('Update Profile API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred updating profile.' });
  }
});

// 3. Toggle Follow / Unfollow
router.post('/follow/:userId', authenticateToken, async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  const currentUserId = req.user.id;

  if (targetUserId === currentUserId) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  try {
    // Check if already following
    const followCheck = await db.query(
      'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUserId, targetUserId]
    );

    if (followCheck.rowCount > 0) {
      // Unfollow
      await db.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [currentUserId, targetUserId]);
      
      // Update persistent profile follower/following metrics
      await db.query('UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = $1', [currentUserId]);
      await db.query('UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = $1', [targetUserId]);

      res.json({ message: 'Unfollowed user successfully.', isFollowing: false });
    } else {
      // Follow
      await db.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [currentUserId, targetUserId]);
      
      // Update persistent profile follower/following metrics
      await db.query('UPDATE profiles SET following_count = following_count + 1 WHERE user_id = $1', [currentUserId]);
      await db.query('UPDATE profiles SET followers_count = followers_count + 1 WHERE user_id = $1', [targetUserId]);

      res.json({ message: 'Followed user successfully!', isFollowing: true });
    }
  } catch (err) {
    console.error('Toggle Follow API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred during follow toggle.' });
  }
});

// 3.5. Get list of all active users in the network (for direct messaging selection)
router.get('/list', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  try {
    const usersQuery = await db.query(
      `SELECT u.id, u.username, u.email, u.role, p.avatar_url, p.bio, p.favorite_anime 
       FROM users u 
       JOIN profiles p ON u.id = p.user_id 
       WHERE u.id != $1 AND u.status = 'active'
       ORDER BY u.username ASC`,
      [currentUserId]
    );
    res.json(usersQuery.rows);
  } catch (err) {
    console.error('Fetch users list API Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving users list.' });
  }
});

// 3.6. Get list of followers for a user
router.get('/:userId/followers', authenticateToken, async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  try {
    const followersQuery = await db.query(
      `SELECT u.id, u.username, p.avatar_url, p.bio, p.favorite_anime 
       FROM follows f 
       JOIN users u ON f.follower_id = u.id 
       JOIN profiles p ON u.id = p.user_id 
       WHERE f.following_id = $1`,
      [targetUserId]
    );
    res.json(followersQuery.rows);
  } catch (err) {
    console.error('Fetch followers list API Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving followers list.' });
  }
});

// 3.7. Get list of users a user is following
router.get('/:userId/following', authenticateToken, async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  try {
    const followingQuery = await db.query(
      `SELECT u.id, u.username, p.avatar_url, p.bio, p.favorite_anime 
       FROM follows f 
       JOIN users u ON f.following_id = u.id 
       JOIN profiles p ON u.id = p.user_id 
       WHERE f.follower_id = $1`,
      [targetUserId]
    );
    res.json(followingQuery.rows);
  } catch (err) {
    console.error('Fetch following list API Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving following list.' });
  }
});

// 4. Integrated Search System (Usernames, Posts Content, or Anime Tags)
router.get('/search', authenticateToken, async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  const searchTerm = `%${q}%`;

  try {
    // Search users
    const usersQuery = await db.query(
      'SELECT u.id, u.username, p.avatar_url, p.bio, p.favorite_anime FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.username iLike $1 OR p.favorite_anime iLike $2 LIMIT 10',
      [searchTerm, searchTerm]
    );

    // Search posts
    const postsQuery = await db.query(
      'SELECT p.*, u.username, pr.avatar_url FROM posts p JOIN users u ON p.user_id = u.id JOIN profiles pr ON p.user_id = pr.user_id WHERE p.content iLike $1 OR $2 = ANY(p.tags) ORDER BY p.created_at DESC LIMIT 10',
      [searchTerm, q]
    );

    res.json({
      users: usersQuery.rows,
      posts: postsQuery.rows
    });
  } catch (err) {
    console.error('Search API Error:', err.message);
    res.status(500).json({ error: 'Server error occurred executing search query.' });
  }
});

module.exports = router;
