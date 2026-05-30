require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');

// Import routes
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const usersRoutes = require('./routes/users');
const notificationsRoutes = require('./routes/notifications');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const messagesRoutes = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Basic Middlewares & Security Settings
app.use(helmet({
  crossOriginResourcePolicy: false // Allows loading local uploads if needed
}));
app.use(cors({
  origin: '*', // For local dev and Vercel hosting ease
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads static folder (for local file upload backups if used)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Security Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', globalLimiter);

// 3. Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messagesRoutes);

// Base health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    databaseMode: db.isMock() ? 'Local Mock DB' : 'Supabase PostgreSQL'
  });
});

// 4. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// 5. Initialize Database & Launch Server
const startServer = async () => {
  try {
    // Bootstrap database tables/JSON structure
    await db.initDb();

    app.listen(PORT, () => {
      console.log(`===========================================================`);
      console.log(`  NARUBOOK BACKEND SERVER IS RUNNING ON PORT ${PORT}      `);
      console.log(`  Mode: ${db.isMock() ? 'LOCAL MOCK DATABASE' : 'SUPABASE POSTGRESQL'}`);
      console.log(`===========================================================`);
    });
  } catch (error) {
    console.error('Critical: Failed to launch backend server:', error.message);
    process.exit(1);
  }
};

startServer();
