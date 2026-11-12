import express from 'express';
import cors from 'cors';
import pool from './db/pool.js';
import authRoutes from './routes/auth.routes.js';
import postRoutes from './routes/post.routes.js';
import friendRoutes from './routes/friend.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import userRoutes from './routes/user.routes.js';
import groupRoutes from './routes/group.routes.js';
import { notfound, errorhandler } from './middleware/errorhandler.js';

const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      message: 'pulsenet api is healthy',
      database: 'connected',
      uptime: process.uptime(),
    });
  } catch (err) {
    console.error('Healthcheck error:', err);
    res.status(500).json({ error: 'database connection failed' });
  }
});

app.use(notfound);
app.use(errorhandler);

export default app;
