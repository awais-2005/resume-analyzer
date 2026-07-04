import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { testRouter } from './routes/test.route';
import { resumeRouter } from './routes/resume.route';
import { authRouter } from './routes/auth.route';
import requestLogger from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import rateLimiter from './middleware/rateLimiter';
import { requireAuth } from './middleware/requireAuth';
import { initPassport } from './config/passport';

const app = express();

app.use(cors({ origin: "*" }));

// For parsing all req bodies into object
app.use(express.json());

// Initialize Passport (Google OAuth)
initPassport(app);

// app.use(rateLimiter);
app.use(requestLogger);

// Lightweight health check for uptime pings (keeps Render free-tier instance awake)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/test", testRouter);
app.use("/resume", requireAuth, resumeRouter);

app.use(errorHandler);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

export default app;
