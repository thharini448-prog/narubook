const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const MOCK_DB_PATH = path.join(__dirname, 'mockDb.json');
let pool = null;
let useMock = true;

// Check if PostgreSQL URL is provided
if (process.env.SUPABASE_DB_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false } // Required for Supabase in many environments
    });
    useMock = false;
    console.log('Database Layer: Supabase PostgreSQL connection configured.');
  } catch (err) {
    console.error('Database Connection Error. Falling back to Mock DB:', err.message);
    useMock = true;
  }
} else {
  console.log('Database Layer: No Supabase URL found in env. Running in Local Mock Database Mode.');
}

// SQL DDL to initialize database tables on Supabase if they do not exist
const DDL_STATEMENTS = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url VARCHAR(500),
  banner_url VARCHAR(500),
  bio TEXT,
  favorite_anime VARCHAR(255),
  fandoms TEXT[],
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(50) DEFAULT 'text',
  tags TEXT[],
  group_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  post_id INT REFERENCES posts(id) ON DELETE CASCADE,
  reaction_type VARCHAR(50) DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_post_like UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id INT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_id INT REFERENCES users(id) ON DELETE CASCADE,
  following_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
  sender_id INT REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'like', 'comment', 'follow'
  post_id INT REFERENCES posts(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INT REFERENCES users(id) ON DELETE CASCADE,
  post_id INT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL, -- 'harassment', 'hate_speech', 'nsfw', 'spam', 'copyright'
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'block', 'unblock', 'suspend', 'delete_post', 'delete_comment'
  target_id INT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INT REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Helper to encrypt password
const hashPassword = (password) => {
  return bcrypt.hashSync(password, 10);
};

// Seed Data definition
const getSeeds = () => {
  const adminPasswordHash = hashPassword('admin123');
  const userPasswordHash = hashPassword('user123');

  return {
    users: [
      { id: 1, email: 'madaeshm@gmail.com', password_hash: adminPasswordHash, username: 'GokuAdmin', role: 'admin', status: 'active', created_at: new Date().toISOString() },
      { id: 2, email: 'naruto@narubook.com', password_hash: userPasswordHash, username: 'NarutoUzumaki', role: 'user', status: 'active', created_at: new Date().toISOString() },
      { id: 3, email: 'sasuke@narubook.com', password_hash: userPasswordHash, username: 'SasukeUchiha', role: 'user', status: 'active', created_at: new Date().toISOString() },
      { id: 4, email: 'luffy@narubook.com', password_hash: userPasswordHash, username: 'MonkeyDLuffy', role: 'user', status: 'active', created_at: new Date().toISOString() }
    ],
    profiles: [
      { user_id: 1, avatar_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80', banner_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80', bio: 'The legendary administrator of NaruBook. Ready to protect the fandom!', favorite_anime: 'Dragon Ball Z', fandoms: ['DBZ', 'Action', 'Shonen'], followers_count: 3, following_count: 0 },
      { user_id: 2, avatar_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80', banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80', bio: 'I will become the Hokage! Dattebayo!', favorite_anime: 'Naruto Shippuden', fandoms: ['Naruto', 'Ninjutsu', 'Shonen'], followers_count: 1, following_count: 2 },
      { user_id: 3, avatar_url: 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=150&auto=format&fit=crop&q=80', banner_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&auto=format&fit=crop&q=80', bio: 'Avenging my clan, in the shadows.', favorite_anime: 'Naruto', fandoms: ['Uchiha', 'DarkTheme'], followers_count: 1, following_count: 1 },
      { user_id: 4, avatar_url: 'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=150&auto=format&fit=crop&q=80', banner_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80', bio: 'I am gonna be the King of the Pirates!', favorite_anime: 'One Piece', fandoms: ['OnePiece', 'Adventure', 'StrawHat'], followers_count: 1, following_count: 3 }
    ],
    posts: [
      { id: 1, user_id: 2, content: 'Just finished rewatching the Pain Arc in Naruto. The fight between Naruto and Pain is still the absolute pinnacle of anime storytelling! What do you guys think? #Naruto #AnimeDisc', media_url: 'https://media.giphy.com/media/V8tD54CX95khy/giphy.gif', media_type: 'gif', tags: ['Naruto', 'AnimeDisc'], group_id: null, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
      { id: 2, user_id: 4, content: 'Look at my new Gear 5 dynamic background! Absolutely legendary gear transformation. Who else is caught up with the manga? #OnePiece #Gear5', media_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80', media_type: 'image', tags: ['OnePiece', 'Gear5'], group_id: null, created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 3, user_id: 3, content: 'Chidori training session. Keep working in silence.', media_url: '', media_type: 'text', tags: ['Uchiha'], group_id: null, created_at: new Date(Date.now() - 1800000).toISOString() }
    ],
    likes: [
      { id: 1, user_id: 4, post_id: 1, reaction_type: 'like', created_at: new Date().toISOString() },
      { id: 2, user_id: 3, post_id: 1, reaction_type: 'heart', created_at: new Date().toISOString() },
      { id: 3, user_id: 2, post_id: 2, reaction_type: 'fire', created_at: new Date().toISOString() }
    ],
    comments: [
      { id: 1, post_id: 1, user_id: 3, content: 'Still took you long enough to beat him, loser.', parent_id: null, created_at: new Date(Date.now() - 3000000).toISOString() },
      { id: 2, post_id: 1, user_id: 2, content: 'Shut up Sasuke! You were not even there!', parent_id: 1, created_at: new Date(Date.now() - 2500000).toISOString() },
      { id: 3, post_id: 2, user_id: 1, content: 'Amazing transformation! Gear 5 broke the internet!', parent_id: null, created_at: new Date(Date.now() - 500000).toISOString() }
    ],
    follows: [
      { id: 1, follower_id: 2, following_id: 3, created_at: new Date().toISOString() },
      { id: 2, follower_id: 3, following_id: 2, created_at: new Date().toISOString() },
      { id: 3, follower_id: 4, following_id: 2, created_at: new Date().toISOString() },
      { id: 4, follower_id: 2, following_id: 4, created_at: new Date().toISOString() }
    ],
    notifications: [
      { id: 1, recipient_id: 2, sender_id: 4, type: 'like', post_id: 1, is_read: false, created_at: new Date().toISOString() },
      { id: 2, recipient_id: 2, sender_id: 3, type: 'comment', post_id: 1, is_read: false, created_at: new Date().toISOString() }
    ],
    reports: [
      { id: 1, reporter_id: 3, post_id: 2, comment_id: null, reason: 'spam', status: 'pending', created_at: new Date().toISOString() }
    ],
    moderation_logs: [
      { id: 1, admin_id: 1, action: 'system_init', target_id: 0, details: 'NaruBook System Initialized.', created_at: new Date().toISOString() }
    ],
    messages: [
      { id: 1, sender_id: 2, recipient_id: 3, content: 'Hey Sasuke, are you ready for training?', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, sender_id: 3, recipient_id: 2, content: 'Hmph. I am always ready, Naruto.', created_at: new Date(Date.now() - 1800000).toISOString() }
    ],
    // API, DB, and Bandwidth metrics simulating active tracking
    system_metrics: {
      db_rows: 25,
      db_bytes: 45000,
      storage_bytes: 1800000000, // ~1.8 GB out of 5 GB
      bandwidth_bytes: 12500000000, // ~12.5 GB out of 50 GB
      api_requests: 122000, // out of 200,000 requests
      vercel_bandwidth_bytes: 19500000000, // ~19.5 GB
      vercel_build_minutes: 65, // out of 100 minutes
      last_updated: new Date().toISOString()
    }
  };
};

// Initialize Mock JSON File or Database Tables
const initDb = async () => {
  if (!useMock) {
    try {
      // Execute standard DDL on Supabase
      await pool.query(DDL_STATEMENTS);
      console.log('Database Layer: Supabase tables verified/created successfully.');
      
      // Check if admin user exists in live DB, if not seed all tables
      const checkAdmin = await pool.query('SELECT * FROM users WHERE email = $1', ['madaeshm@gmail.com']);
      if (checkAdmin.rowCount === 0) {
        console.log('Database Layer: Seeding live Supabase PostgreSQL database...');
        const seeds = getSeeds();
        
        // Seed Users
        for (const u of seeds.users) {
          await pool.query(
            'INSERT INTO users (id, email, password_hash, username, role, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
            [u.id, u.email, u.password_hash, u.username, u.role, u.status]
          );
        }
        
        // Seed Profiles
        for (const p of seeds.profiles) {
          await pool.query(
            'INSERT INTO profiles (user_id, avatar_url, banner_url, bio, favorite_anime, fandoms, followers_count, following_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING',
            [p.user_id, p.avatar_url, p.banner_url, p.bio, p.favorite_anime, p.fandoms, p.followers_count, p.following_count]
          );
        }
        
        // Seed Posts
        for (const po of seeds.posts) {
          await pool.query(
            'INSERT INTO posts (id, user_id, content, media_url, media_type, tags) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
            [po.id, po.user_id, po.content, po.media_url, po.media_type, po.tags]
          );
        }

        // Seed Comments
        for (const c of seeds.comments) {
          await pool.query(
            'INSERT INTO comments (id, post_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            [c.id, c.post_id, c.user_id, c.content, c.parent_id]
          );
        }

        // Seed Likes
        for (const l of seeds.likes) {
          await pool.query(
            'INSERT INTO likes (id, user_id, post_id, reaction_type) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [l.id, l.user_id, l.post_id, l.reaction_type]
          );
        }

        // Seed Follows
        for (const f of seeds.follows) {
          await pool.query(
            'INSERT INTO follows (id, follower_id, following_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [f.id, f.follower_id, f.following_id]
          );
        }

        // Seed Reports
        for (const r of seeds.reports) {
          await pool.query(
            'INSERT INTO reports (id, reporter_id, post_id, comment_id, reason, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
            [r.id, r.reporter_id, r.post_id, r.comment_id, r.reason, r.status]
          );
        }

        // Seed Logs
        for (const ml of seeds.moderation_logs) {
          await pool.query(
            'INSERT INTO moderation_logs (id, admin_id, action, target_id, details) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            [ml.id, ml.admin_id, ml.action, ml.target_id, ml.details]
          );
        }

        // Seed Messages
        for (const msg of seeds.messages || []) {
          await pool.query(
            'INSERT INTO messages (id, sender_id, recipient_id, content) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [msg.id, msg.sender_id, msg.recipient_id, msg.content]
          );
        }
        
        // Reset serial sequences
        const sequences = ['users', 'posts', 'likes', 'comments', 'follows', 'notifications', 'reports', 'moderation_logs', 'messages'];
        for (const seq of sequences) {
          await pool.query(`SELECT setval(pg_get_serial_sequence('${seq}', 'id'), COALESCE(MAX(id), 1)) FROM ${seq}`);
        }
        console.log('Database Layer: Supabase seeding completed.');
      }
    } catch (err) {
      console.error('Database DDL execution error. Switching to Mock Store:', err.message);
      useMock = true;
    }
  }

  // Double check mock database is initialized
  if (useMock) {
    if (!fs.existsSync(MOCK_DB_PATH)) {
      const initialSeed = getSeeds();
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(initialSeed, null, 2), 'utf8');
      console.log('Database Layer: Local Mock Database initialized and seeded successfully.');
    } else {
      console.log('Database Layer: Local Mock Database loaded from mockDb.json.');
    }
  }
};

// JSON Database operations wrapper (Replicates SQL statements in Local Mock Database)
const mockDb = {
  read: () => {
    try {
      const data = fs.readFileSync(MOCK_DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      const seeds = getSeeds();
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(seeds, null, 2), 'utf8');
      return seeds;
    }
  },
  write: (data) => {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
};

// Database Query Adapter
const query = async (text, params = []) => {
  if (!useMock) {
    return await pool.query(text, params);
  }

  // --- MOCK DATABASE QUERY MAPPING ENGINE ---
  // A robust local PostgreSQL emulator executing basic matching on parameterized statements
  const dbData = mockDb.read();
  const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedText = normalize(text);

  let rows = [];
  let rowCount = 0;

  // 1. AUTH & USER TABLES
  if (normalizedText.includes('from users u join profiles p on u.id = p.user_id') && normalizedText.includes('u.id != $1')) {
    const currentUserId = parseInt(params[0]);
    rows = dbData.users
      .filter(u => u.id !== currentUserId && u.status === 'active')
      .map(u => {
        const profile = dbData.profiles.find(p => p.user_id === u.id) || {};
        return { ...u, ...profile };
      })
      .sort((a, b) => a.username.localeCompare(b.username));
  }
  else if (normalizedText.includes('from users u join profiles p on u.id = p.user_id') && normalizedText.includes('where u.id =')) {
    const userId = parseInt(params[0]);
    const user = dbData.users.find(u => u.id === userId);
    const profile = dbData.profiles.find(p => p.user_id === userId);
    if (user && profile) {
      rows = [{ ...user, ...profile }];
    }
  }
  else if (normalizedText.includes('from users u join profiles p on u.id = p.user_id') && !normalizedText.includes('where')) {
    rows = dbData.users
      .map(u => {
        const profile = dbData.profiles.find(p => p.user_id === u.id) || {};
        return { ...u, ...profile };
      })
      .sort((a, b) => a.id - b.id);
  }
  else if (normalizedText.includes('from follows f join users u') && normalizedText.includes('where f.following_id =')) {
    const followingId = parseInt(params[0]);
    const matchingFollows = dbData.follows.filter(f => f.following_id === followingId);
    rows = matchingFollows.map(f => {
      const u = dbData.users.find(usr => usr.id === f.follower_id) || {};
      const p = dbData.profiles.find(prof => prof.user_id === f.follower_id) || {};
      return {
        id: u.id,
        username: u.username,
        avatar_url: p.avatar_url,
        bio: p.bio,
        favorite_anime: p.favorite_anime
      };
    });
  }
  else if (normalizedText.includes('from follows f join users u') && normalizedText.includes('where f.follower_id =')) {
    const followerId = parseInt(params[0]);
    const matchingFollows = dbData.follows.filter(f => f.follower_id === followerId);
    rows = matchingFollows.map(f => {
      const u = dbData.users.find(usr => usr.id === f.following_id) || {};
      const p = dbData.profiles.find(prof => prof.user_id === f.following_id) || {};
      return {
        id: u.id,
        username: u.username,
        avatar_url: p.avatar_url,
        bio: p.bio,
        favorite_anime: p.favorite_anime
      };
    });
  }
  else if (normalizedText.includes('from users') && normalizedText.includes('email =')) {
    const email = params[0];
    rows = dbData.users.filter(u => u.email.toLowerCase() === email.toLowerCase());
  } 
  else if (normalizedText.includes('from users') && normalizedText.includes('username =')) {
    const username = params[0];
    rows = dbData.users.filter(u => u.username.toLowerCase() === username.toLowerCase());
  }
  else if (normalizedText.includes('from users') && normalizedText.includes('id =')) {
    const id = parseInt(params[0]);
    rows = dbData.users.filter(u => u.id === id);
  }
  else if (normalizedText.startsWith('insert into users')) {
    // INSERT INTO users (email, password_hash, username, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING *
    const email = params[0];
    const passwordHash = params[1];
    const username = params[2];
    const role = params[3] || 'user';
    const status = params[4] || 'active';
    
    // Check uniqueness
    if (dbData.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Duplicate key value violates unique constraint "users_email_key"');
    }
    if (dbData.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Duplicate key value violates unique constraint "users_username_key"');
    }

    const newId = dbData.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const newUser = { id: newId, email, password_hash: passwordHash, username, role, status, created_at: new Date().toISOString() };
    dbData.users.push(newUser);
    
    // Auto-create blank profile
    const newProfile = { 
      user_id: newId, 
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', 
      banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80', 
      bio: 'New NaruBook fan!', 
      favorite_anime: 'None', 
      fandoms: [], 
      followers_count: 0, 
      following_count: 0 
    };
    dbData.profiles.push(newProfile);
    
    mockDb.write(dbData);
    rows = [newUser];
  }
  else if (normalizedText.startsWith('update users set password_hash =')) {
    const passwordHash = params[0];
    const email = params[1];
    const userIndex = dbData.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (userIndex !== -1) {
      dbData.users[userIndex].password_hash = passwordHash;
      mockDb.write(dbData);
      rows = [dbData.users[userIndex]];
    }
  }
  else if (normalizedText.startsWith('update users set status =')) {
    const status = params[0];
    const id = parseInt(params[1]);
    const userIndex = dbData.users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      dbData.users[userIndex].status = status;
      mockDb.write(dbData);
      rows = [dbData.users[userIndex]];
    }
  }

  // 2. PROFILES
  else if (normalizedText.startsWith('select * from profiles where user_id =')) {
    const userId = parseInt(params[0]);
    rows = dbData.profiles.filter(p => p.user_id === userId);
  }
  else if (normalizedText.startsWith('update profiles set following_count =')) {
    const userId = parseInt(params[0]);
    const profileIndex = dbData.profiles.findIndex(p => p.user_id === userId);
    if (profileIndex !== -1) {
      if (normalizedText.includes('+ 1')) {
        dbData.profiles[profileIndex].following_count = (dbData.profiles[profileIndex].following_count || 0) + 1;
      } else {
        dbData.profiles[profileIndex].following_count = Math.max(0, (dbData.profiles[profileIndex].following_count || 0) - 1);
      }
      mockDb.write(dbData);
      rows = [dbData.profiles[profileIndex]];
    }
  }
  else if (normalizedText.startsWith('update profiles set followers_count =')) {
    const userId = parseInt(params[0]);
    const profileIndex = dbData.profiles.findIndex(p => p.user_id === userId);
    if (profileIndex !== -1) {
      if (normalizedText.includes('+ 1')) {
        dbData.profiles[profileIndex].followers_count = (dbData.profiles[profileIndex].followers_count || 0) + 1;
      } else {
        dbData.profiles[profileIndex].followers_count = Math.max(0, (dbData.profiles[profileIndex].followers_count || 0) - 1);
      }
      mockDb.write(dbData);
      rows = [dbData.profiles[profileIndex]];
    }
  }
  else if (normalizedText.startsWith('update profiles set')) {
    // update profiles set avatar_url = $1, banner_url = $2, bio = $3, favorite_anime = $4, fandoms = $5 where user_id = $6
    const avatarUrl = params[0];
    const bannerUrl = params[1];
    const bio = params[2];
    const favoriteAnime = params[3];
    const fandoms = params[4]; // Array
    const userId = parseInt(params[5]);

    const profileIndex = dbData.profiles.findIndex(p => p.user_id === userId);
    if (profileIndex !== -1) {
      dbData.profiles[profileIndex] = {
        ...dbData.profiles[profileIndex],
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        bio: bio,
        favorite_anime: favoriteAnime,
        fandoms: Array.isArray(fandoms) ? fandoms : []
      };
      mockDb.write(dbData);
      rows = [dbData.profiles[profileIndex]];
    }
  }

  // 2.5 MOCK SQL HELPER ADDITIONS
  else if (normalizedText.startsWith('select * from posts where id =')) {
    const id = parseInt(params[0]);
    rows = dbData.posts.filter(p => p.id === id);
  }
  else if (normalizedText.startsWith('select * from comments where id =')) {
    const id = parseInt(params[0]);
    rows = dbData.comments.filter(c => c.id === id);
  }
  else if (normalizedText.startsWith('select reaction_type, user_id from likes where post_id =') || 
           normalizedText.startsWith('select reaction_type from likes where post_id =')) {
    const postId = parseInt(params[0]);
    rows = dbData.likes.filter(l => l.post_id === postId);
  }
  else if (normalizedText.startsWith('select reaction_type from likes where post_id =') && normalizedText.includes('user_id =')) {
    const postId = parseInt(params[0]);
    const userId = parseInt(params[1]);
    rows = dbData.likes.filter(l => l.post_id === postId && l.user_id === userId);
  }
  else if (normalizedText.startsWith('select id from comments where post_id =')) {
    const postId = parseInt(params[0]);
    rows = dbData.comments.filter(c => c.post_id === postId);
  }


  // 3. POSTS
  else if (normalizedText.includes('select p.*, u.username, pr.avatar_url') && !normalizedText.includes('where')) {
    // Main feed query
    rows = dbData.posts.map(post => {
      const u = dbData.users.find(usr => usr.id === post.user_id) || {};
      const pr = dbData.profiles.find(prof => prof.user_id === post.user_id) || {};
      const postLikes = dbData.likes.filter(l => l.post_id === post.id);
      const postComments = dbData.comments.filter(c => c.post_id === post.id);
      return {
        ...post,
        username: u.username,
        avatar_url: pr.avatar_url,
        likes_count: postLikes.length,
        comments_count: postComments.length
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  else if (normalizedText.includes('select p.*, u.username, pr.avatar_url') && normalizedText.includes('p.user_id =')) {
    // Profile-specific feed query
    const userId = parseInt(params[0]);
    rows = dbData.posts.filter(p => p.user_id === userId).map(post => {
      const u = dbData.users.find(usr => usr.id === post.user_id) || {};
      const pr = dbData.profiles.find(prof => prof.user_id === post.user_id) || {};
      const postLikes = dbData.likes.filter(l => l.post_id === post.id);
      const postComments = dbData.comments.filter(c => c.post_id === post.id);
      return {
        ...post,
        username: u.username,
        avatar_url: pr.avatar_url,
        likes_count: postLikes.length,
        comments_count: postComments.length
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  else if (normalizedText.includes('select p.*, u.username, pr.avatar_url') && normalizedText.includes('post_id') || normalizedText.includes('p.id =')) {
    // Single post view query
    const postId = parseInt(params[0]);
    const post = dbData.posts.find(p => p.id === postId);
    if (post) {
      const u = dbData.users.find(usr => usr.id === post.user_id) || {};
      const pr = dbData.profiles.find(prof => prof.user_id === post.user_id) || {};
      const postLikes = dbData.likes.filter(l => l.post_id === post.id);
      const postComments = dbData.comments.filter(c => c.post_id === post.id);
      rows = [{
        ...post,
        username: u.username,
        avatar_url: pr.avatar_url,
        likes_count: postLikes.length,
        comments_count: postComments.length
      }];
    }
  }
  else if (normalizedText.startsWith('insert into posts')) {
    // INSERT INTO posts (user_id, content, media_url, media_type, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *
    const userId = parseInt(params[0]);
    const content = params[1];
    const mediaUrl = params[2];
    const mediaType = params[3] || 'text';
    const tags = params[4] || [];

    const newId = dbData.posts.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const newPost = { id: newId, user_id: userId, content, media_url: mediaUrl, media_type: mediaType, tags, created_at: new Date().toISOString() };
    dbData.posts.push(newPost);
    
    // Update active system health database size
    dbData.system_metrics.db_rows += 1;
    dbData.system_metrics.db_bytes += 250;

    mockDb.write(dbData);
    rows = [newPost];
  }
  else if (normalizedText.startsWith('delete from posts where id =')) {
    const id = parseInt(params[0]);
    const postIndex = dbData.posts.findIndex(p => p.id === id);
    if (postIndex !== -1) {
      const deleted = dbData.posts.splice(postIndex, 1);
      // Clean up likes and comments
      dbData.likes = dbData.likes.filter(l => l.post_id !== id);
      dbData.comments = dbData.comments.filter(c => c.post_id !== id);
      dbData.reports = dbData.reports.filter(r => r.post_id !== id);
      
      mockDb.write(dbData);
      rows = deleted;
    }
  }

  // 4. LIKES SYSTEM
  else if (normalizedText.startsWith('select * from likes where user_id =') && normalizedText.includes('post_id =')) {
    const userId = parseInt(params[0]);
    const postId = parseInt(params[1]);
    rows = dbData.likes.filter(l => l.user_id === userId && l.post_id === postId);
  }
  else if (normalizedText.startsWith('insert into likes')) {
    // insert into likes (user_id, post_id, reaction_type) values ($1, $2, $3)
    const userId = parseInt(params[0]);
    const postId = parseInt(params[1]);
    const reaction = params[2] || 'like';

    if (dbData.likes.some(l => l.user_id === userId && l.post_id === postId)) {
      throw new Error('Duplicate key value violates unique constraint "unique_user_post_like"');
    }

    const newId = dbData.likes.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    const newLike = { id: newId, user_id: userId, post_id: postId, reaction_type: reaction, created_at: new Date().toISOString() };
    dbData.likes.push(newLike);
    
    // Add real-time log activity / notifications
    const postOwner = dbData.posts.find(p => p.id === postId);
    if (postOwner && postOwner.user_id !== userId) {
      const notifId = dbData.notifications.reduce((max, n) => Math.max(max, n.id), 0) + 1;
      dbData.notifications.push({
        id: notifId,
        recipient_id: postOwner.user_id,
        sender_id: userId,
        type: 'like',
        post_id: postId,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    mockDb.write(dbData);
    rows = [newLike];
  }
  else if (normalizedText.startsWith('delete from likes where user_id =') && normalizedText.includes('post_id =')) {
    const userId = parseInt(params[0]);
    const postId = parseInt(params[1]);
    const likeIndex = dbData.likes.findIndex(l => l.user_id === userId && l.post_id === postId);
    if (likeIndex !== -1) {
      const deleted = dbData.likes.splice(likeIndex, 1);
      mockDb.write(dbData);
      rows = deleted;
    }
  }

  // 5. COMMENTS SYSTEM
  else if (normalizedText.includes('select c.*, u.username, pr.avatar_url') && normalizedText.includes('post_id =')) {
    const postId = parseInt(params[0]);
    rows = dbData.comments.filter(c => c.post_id === postId).map(c => {
      const u = dbData.users.find(usr => usr.id === c.user_id) || {};
      const pr = dbData.profiles.find(prof => prof.user_id === c.user_id) || {};
      return {
        ...c,
        username: u.username,
        avatar_url: pr.avatar_url
      };
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  else if (normalizedText.startsWith('insert into comments')) {
    // insert into comments (post_id, user_id, content, parent_id) values ($1, $2, $3, $4)
    const postId = parseInt(params[0]);
    const userId = parseInt(params[1]);
    const content = params[2];
    const parentId = params[3] ? parseInt(params[3]) : null;

    const newId = dbData.comments.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const newComment = { id: newId, post_id: postId, user_id: userId, content, parent_id: parentId, created_at: new Date().toISOString() };
    dbData.comments.push(newComment);

    // Notification
    const postOwner = dbData.posts.find(p => p.id === postId);
    if (postOwner && postOwner.user_id !== userId) {
      const notifId = dbData.notifications.reduce((max, n) => Math.max(max, n.id), 0) + 1;
      dbData.notifications.push({
        id: notifId,
        recipient_id: postOwner.user_id,
        sender_id: userId,
        type: 'comment',
        post_id: postId,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    mockDb.write(dbData);
    rows = [newComment];
  }
  else if (normalizedText.startsWith('update comments set content =')) {
    const content = params[0];
    const commentId = parseInt(params[1]);
    const userId = parseInt(params[2]);
    
    const commentIndex = dbData.comments.findIndex(c => c.id === commentId && c.user_id === userId);
    if (commentIndex !== -1) {
      dbData.comments[commentIndex].content = content;
      mockDb.write(dbData);
      rows = [dbData.comments[commentIndex]];
    }
  }
  else if (normalizedText.startsWith('delete from comments where id =')) {
    const commentId = parseInt(params[0]);
    const commentIndex = dbData.comments.findIndex(c => c.id === commentId);
    if (commentIndex !== -1) {
      const deleted = dbData.comments.splice(commentIndex, 1);
      // Clean up child comments
      dbData.comments = dbData.comments.filter(c => c.parent_id !== commentId);
      dbData.reports = dbData.reports.filter(r => r.comment_id !== commentId);
      mockDb.write(dbData);
      rows = deleted;
    }
  }

  // 6. FOLLOWS & PROFILE STATS
  else if (normalizedText.startsWith('select * from follows where follower_id =') && normalizedText.includes('following_id =')) {
    const followerId = parseInt(params[0]);
    const followingId = parseInt(params[1]);
    rows = dbData.follows.filter(f => f.follower_id === followerId && f.following_id === followingId);
  }
  else if (normalizedText.startsWith('insert into follows')) {
    const followerId = parseInt(params[0]);
    const followingId = parseInt(params[1]);

    if (dbData.follows.some(f => f.follower_id === followerId && f.following_id === followingId)) {
      throw new Error('Duplicate key error in follows');
    }

    const newId = dbData.follows.reduce((max, f) => Math.max(max, f.id), 0) + 1;
    const newFollow = { id: newId, follower_id: followerId, following_id: followingId, created_at: new Date().toISOString() };
    dbData.follows.push(newFollow);

    // Update profiles counters
    const followerProf = dbData.profiles.find(p => p.user_id === followerId);
    if (followerProf) followerProf.following_count += 1;

    const followingProf = dbData.profiles.find(p => p.user_id === followingId);
    if (followingProf) followingProf.followers_count += 1;

    // Send notifications
    const notifId = dbData.notifications.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    dbData.notifications.push({
      id: notifId,
      recipient_id: followingId,
      sender_id: followerId,
      type: 'follow',
      post_id: null,
      is_read: false,
      created_at: new Date().toISOString()
    });

    mockDb.write(dbData);
    rows = [newFollow];
  }
  else if (normalizedText.startsWith('delete from follows where follower_id =') && normalizedText.includes('following_id =')) {
    const followerId = parseInt(params[0]);
    const followingId = parseInt(params[1]);
    
    const index = dbData.follows.findIndex(f => f.follower_id === followerId && f.following_id === followingId);
    if (index !== -1) {
      dbData.follows.splice(index, 1);
      
      const followerProf = dbData.profiles.find(p => p.user_id === followerId);
      if (followerProf && followerProf.following_count > 0) followerProf.following_count -= 1;

      const followingProf = dbData.profiles.find(p => p.user_id === followingId);
      if (followingProf && followingProf.followers_count > 0) followingProf.followers_count -= 1;

      mockDb.write(dbData);
      rows = [{ success: true }];
    }
  }

  // 7. NOTIFICATIONS
  else if (normalizedText.includes('from notifications') && normalizedText.includes('recipient_id =')) {
    const recipientId = parseInt(params[0]);
    rows = dbData.notifications.filter(n => n.recipient_id === recipientId).map(n => {
      const u = dbData.users.find(usr => usr.id === n.sender_id) || {};
      const pr = dbData.profiles.find(prof => prof.user_id === n.sender_id) || {};
      return {
        ...n,
        sender_username: u.username,
        sender_avatar: pr.avatar_url
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  else if (normalizedText.includes('update notifications set is_read = true') || normalizedText.includes('update notifications set is_read=true')) {
    const recipientId = parseInt(params[0]);
    dbData.notifications.forEach(n => {
      if (n.recipient_id === recipientId) n.is_read = true;
    });
    mockDb.write(dbData);
    rows = [{ success: true }];
  }

  // 8. SEARCH ENGINE
  else if (normalizedText.includes('like $1') && normalizedText.includes('from users')) {
    // select u.id, u.username, p.avatar_url, p.bio from users u join profiles p on u.id = p.user_id where u.username iLike $1 or p.favorite_anime iLike $2
    const term = params[0].replace(/%/g, '').toLowerCase();
    rows = dbData.users.filter(u => u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
      .map(u => {
        const pr = dbData.profiles.find(p => p.user_id === u.id) || {};
        return {
          id: u.id,
          username: u.username,
          avatar_url: pr.avatar_url,
          bio: pr.bio,
          favorite_anime: pr.favorite_anime
        };
      });
  }
  else if (normalizedText.includes('like $1') && normalizedText.includes('from posts')) {
    // Search posts tags or content
    const term = params[0].replace(/%/g, '').toLowerCase();
    rows = dbData.posts.filter(p => p.content.toLowerCase().includes(term) || p.tags.some(t => t.toLowerCase().includes(term))).map(post => {
      const u = dbData.users.find(usr => usr.id === post.user_id) || {};
      const pr = dbData.profiles.find(prof => prof.user_id === post.user_id) || {};
      return {
        ...post,
        username: u.username,
        avatar_url: pr.avatar_url
      };
    });
  }

  // 9. ADMIN SYSTEM & REPORTING
  else if (normalizedText.startsWith('insert into reports')) {
    // insert into reports (reporter_id, post_id, comment_id, reason) values ($1, $2, $3, $4)
    const reporterId = parseInt(params[0]);
    const postId = params[1] ? parseInt(params[1]) : null;
    const commentId = params[2] ? parseInt(params[2]) : null;
    const reason = params[3];

    const newId = dbData.reports.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    const newReport = { id: newId, reporter_id: reporterId, post_id: postId, comment_id: commentId, reason, status: 'pending', created_at: new Date().toISOString() };
    dbData.reports.push(newReport);
    mockDb.write(dbData);
    rows = [newReport];
  }
  else if (normalizedText.includes('select r.*, u.username') && normalizedText.includes('from reports')) {
    // Admin list reports
    rows = dbData.reports.map(r => {
      const reporter = dbData.users.find(u => u.id === r.reporter_id) || {};
      let reportedObj = null;
      if (r.post_id) {
        const post = dbData.posts.find(p => p.id === r.post_id) || {};
        const author = dbData.users.find(u => u.id === post.user_id) || {};
        reportedObj = { type: 'post', content: post.content, author: author.username };
      } else if (r.comment_id) {
        const comment = dbData.comments.find(c => c.id === r.comment_id) || {};
        const author = dbData.users.find(u => u.id === comment.user_id) || {};
        reportedObj = { type: 'comment', content: comment.content, author: author.username };
      }
      return {
        ...r,
        reporter_username: reporter.username,
        target: reportedObj
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  else if (normalizedText.startsWith('insert into moderation_logs')) {
    // insert into moderation_logs (admin_id, action, target_id, details) values ($1, $2, $3, $4)
    const adminId = parseInt(params[0]);
    const action = params[1];
    const targetId = parseInt(params[2]);
    const details = params[3];

    const newId = dbData.moderation_logs.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const newLog = { id: newId, admin_id: adminId, action, target_id: targetId, details, created_at: new Date().toISOString() };
    dbData.moderation_logs.push(newLog);
    mockDb.write(dbData);
    rows = [newLog];
  }
  else if (normalizedText.startsWith('select * from moderation_logs')) {
    rows = dbData.moderation_logs.map(log => {
      const admin = dbData.users.find(u => u.id === log.admin_id) || {};
      return { ...log, admin_username: admin.username };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // 9. MESSAGES TABLE QUERY MAPPING
  else if (normalizedText.startsWith('insert into messages')) {
    // INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *
    const sender_id = parseInt(params[0]);
    const recipient_id = parseInt(params[1]);
    const content = params[2];

    const newId = (dbData.messages || []).reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const newMsg = {
      id: newId,
      sender_id,
      recipient_id,
      content,
      created_at: new Date().toISOString()
    };
    if (!dbData.messages) dbData.messages = [];
    dbData.messages.push(newMsg);
    mockDb.write(dbData);
    rows = [newMsg];
  }
  else if (normalizedText.startsWith('select * from messages') || normalizedText.includes('from messages')) {
    // SELECT * FROM messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY created_at ASC
    // Or other general SELECTs
    const p0 = parseInt(params[0]);
    const p1 = parseInt(params[1]);
    
    let filtered = dbData.messages || [];
    if (!isNaN(p0) && !isNaN(p1)) {
      filtered = filtered.filter(m => 
        (m.sender_id === p0 && m.recipient_id === p1) ||
        (m.sender_id === p1 && m.recipient_id === p0)
      );
    }
    
    // Sort
    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    rows = filtered.map(m => {
      const sender = dbData.users.find(u => u.id === m.sender_id) || {};
      const recipient = dbData.users.find(u => u.id === m.recipient_id) || {};
      const senderProfile = dbData.profiles.find(p => p.user_id === m.sender_id) || {};
      return {
        ...m,
        sender_username: sender.username,
        sender_avatar: senderProfile.avatar_url,
        recipient_username: recipient.username
      };
    });
  }

  // 10. SYSTEM METRICS AND OTHER FALLBACKS
  else if (normalizedText.includes('select * from users') && !normalizedText.includes('where')) {
    rows = dbData.users.map(u => {
      const pr = dbData.profiles.find(p => p.user_id === u.id) || {};
      return { ...u, ...pr };
    });
  }
  else if (normalizedText.includes('select * from system_metrics')) {
    rows = [dbData.system_metrics];
  }
  else if (normalizedText.startsWith('update system_metrics set')) {
    // update system_metrics set api_requests = api_requests + 1, ...
    dbData.system_metrics.api_requests += 1;
    // Every 5 API requests, increment database usage bytes slightly
    if (dbData.system_metrics.api_requests % 5 === 0) {
      dbData.system_metrics.db_bytes += 50;
      dbData.system_metrics.bandwidth_bytes += 1024 * 5; // +5KB
    }

    // --- AUTO-FAILOVER AND MIGRATION ON RESOURCE EXHAUSTION ---
    const LIMITS = {
      supabase_db_bytes: 524288000, // 500 MB Free Plan
      supabase_storage_bytes: 5368709120, // 5 GB Free Plan
      supabase_bandwidth_bytes: 53687091200, // 50 GB Free Plan
      supabase_api_requests: 200000, // 200k monthly requests
      vercel_bandwidth_bytes: 107374182400, // 100 GB Free Plan
      vercel_build_minutes: 100 // 100 Build Minutes
    };

    if (dbData.system_metrics.api_requests >= LIMITS.supabase_api_requests) {
      console.log('--- SYSTEM RESOURCE EXHAUSTION DETECTED ---');
      console.log('Automatically provisioning a new simulated database store and migrating all records...');

      // 1. Log moderation action of the failover
      const adminId = 1; // Default GokuAdmin
      const newLogId = (dbData.moderation_logs || []).reduce((max, m) => Math.max(max, m.id), 0) + 1;
      const failoverLog = {
        id: newLogId,
        admin_id: adminId,
        action: 'system_failover',
        target_id: 0,
        details: `RESOURCE EXHAUSTION PREVENTED: System automatically created a new simulated database instance, migrated all users, profiles, posts, comments, notifications, and messages, and reset usage counters (API hits: ${dbData.system_metrics.api_requests} -> 0).`,
        created_at: new Date().toISOString()
      };
      if (!dbData.moderation_logs) dbData.moderation_logs = [];
      dbData.moderation_logs.push(failoverLog);

      // 2. Reset the usage metrics to zero while keeping the data size counters
      dbData.system_metrics = {
        db_rows: dbData.users.length + dbData.profiles.length + dbData.posts.length + dbData.likes.length + dbData.comments.length + dbData.follows.length + (dbData.messages || []).length,
        db_bytes: dbData.system_metrics.db_bytes, // Keep actual data size
        storage_bytes: 1800000000, // Keep base media
        bandwidth_bytes: 0, // Reset transfer bandwidth
        api_requests: 0, // Reset API request hits
        vercel_bandwidth_bytes: 0, // Reset Vercel bandwidth
        vercel_build_minutes: 0, // Reset Vercel build minutes
        last_updated: new Date().toISOString()
      };
      console.log('Database Layer: Failover completed. All data transferred and metrics reset to 0%.');
    }

    mockDb.write(dbData);
    rows = [dbData.system_metrics];
  }

  rowCount = rows.length;
  return { rows, rowCount };
};

module.exports = {
  initDb,
  query,
  isMock: () => useMock,
  getMockDb: () => mockDb.read(),
  restoreMockDb: (jsonObj) => {
    if (useMock) {
      mockDb.write(jsonObj);
      return true;
    }
    return false;
  }
};
