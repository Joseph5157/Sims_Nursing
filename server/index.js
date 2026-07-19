require('dotenv').config(); // reloaded: 20260719b -- bump to force Railway rebuild when only prisma/ or root docs changed (Watch Paths = /server/** only)

// Prevent unhandled async rejections from crashing the server
process.on('unhandledRejection', (err) => {
  const logger = require('./lib/logger');
  logger.error(`Unhandled rejection: ${err?.message ?? err}`, err);
});

// Also handle uncaught exceptions
process.on('uncaughtException', (err) => {
  const logger = require('./lib/logger');
  logger.error(`Uncaught exception: ${err?.message ?? err}`, err);
  // Exit gracefully after logging
  setTimeout(() => process.exit(1), 1000);
});

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./lib/logger');
const { APP_SHORT_NAME } = require('./lib/branding');
const csrfMiddleware = require('./middleware/csrf');
const botRoutes = require('./routes/bot.routes');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const invitesRoutes = require('./routes/invites.routes');
const adminRoutes = require('./routes/admin.routes');
const dutyTimingSettingsRoutes = require('./routes/duty-timing-settings.routes');
const studentsRoutes = require('./routes/students.routes');
const calendarRoutes = require('./routes/calendar.routes');
const dutySlotsRoutes = require('./routes/duty-slots.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const violationsRoutes = require('./routes/violations.routes');
const violationTypesRoutes  = require('./routes/violation-types.routes');
const dutyReassignmentRequestsRoutes = require('./routes/duty-reassignment-requests.routes');
const messagesRoutes        = require('./routes/messages.routes');
const reportsRoutes         = require('./routes/reports.routes');
const analyticsRoutes       = require('./routes/analytics.routes');
const { startCronJobs } = require('./lib/cron');

const app = express();

// ─── Trust proxy (required for deployed environments like Railway) ─────────────
app.set('trust proxy', 1);

// ─── Security ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],   // Tailwind inline styles + Google Fonts
      imgSrc:        ["'self'", "data:", "blob:"],
      connectSrc:    ["'self'"],
      fontSrc:       ["'self'", "data:", "https://fonts.gstatic.com"],   // Google Fonts
      objectSrc:     ["'none'"],
      frameSrc:      ["'none'"],
      frameAncestors:["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,   // allows Vite assets with crossorigin attr
}));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:5173'];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── HTTP access logging ─────────────────────────────────────────────────────
// Custom token redacts the webhook secret from the URL path so it never appears
// in log files. /bot/webhook/SECRETTOKEN → /bot/webhook/[redacted]
morgan.token('url-safe', (req) =>
  (req.originalUrl || req.url).replace(/^(\/bot\/webhook\/)[^/?#]+/, '$1[redacted]')
);
app.use(morgan(':method :url-safe :status :res[content-length] - :response-time ms', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Telegram Bot Webhook (MUST be before global rate limiter) ────────────────
app.use(express.json()); // Need to parse JSON for webhook
app.use('/bot', botRoutes);

// ─── Health endpoints (MUST be before global rate limiter) ───────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB-backed health check with 5-second timeout
app.get('/health/db', async (req, res) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Health check timeout')), 5000)
  );

  try {
    const prisma = require('./lib/prisma');
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise
    ]);
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error(`/health/db check failed: ${err.message}`);
    res.status(503).json({ status: 'degraded', db: 'error', timestamp: new Date().toISOString() });
  }
});

// Global limiter — high cap, DoS backstop only. Keep the strict OTP limiter in auth.routes.js.
// 100 req/15min would 429 every faculty on a shared NAT IP (30 users × 3 polls = ~90 req/15min).
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(cookieParser());

// ─── CSRF protection (POST/PUT/PATCH/DELETE on authenticated sessions) ────────
app.use(csrfMiddleware);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/invites', invitesRoutes);
app.use('/admin', adminRoutes);
app.use('/duty-timing-settings', dutyTimingSettingsRoutes);
app.use('/students', studentsRoutes);
app.use('/calendar', calendarRoutes);
app.use('/duty-slots', dutySlotsRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/violations', violationsRoutes);
app.use('/violation-types', violationTypesRoutes);
app.use('/duty-reassignment-requests', dutyReassignmentRequestsRoutes);
app.use('/messages',        messagesRoutes);
app.use('/reports',         reportsRoutes);
app.use('/analytics',       analyticsRoutes);

// ─── Static frontend (production only) ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // Catch-all: serve index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // ─── 404 (dev only — in prod the catch-all above handles unknown paths) ────
  app.use((req, res) => {
    res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Route not found.' });
  });
}

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: true,
    code: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
  });
});

// ─── Telegram Webhook Registration ──────────────────────────────────────────
async function registerTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.APP_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !appUrl || !webhookSecret) {
    logger.warn('[WEBHOOK] Missing Telegram credentials; webhook not registered');
    return;
  }

  try {
    const webhookUrl = `${appUrl}/bot/webhook/${webhookSecret}`;
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      logger.info(`[WEBHOOK] Registered: ${webhookUrl}`);
    } else {
      logger.warn(`[WEBHOOK] Registration failed: ${data.description}`);
    }
  } catch (err) {
    logger.error('[WEBHOOK] Registration error:', err.message);
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`${APP_SHORT_NAME} server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  registerTelegramWebhook();
  startCronJobs();
});
