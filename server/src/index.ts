import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './db/database';
import { NotificationEngine } from './services/notificationEngine';
import { LiveTrackingSocketService } from './services/liveTrackingSocket';

// Import Route Handlers
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import vehiclesRouter from './routes/vehicles';
import rtoRouter from './routes/rto';
import insuranceRouter from './routes/insurance';
import pucRouter from './routes/puc';
import fitnessRouter from './routes/fitness';
import permitsRouter from './routes/permits';
import roadTaxRouter from './routes/roadTax';
import fastagRouter from './routes/fastag';
import challansRouter from './routes/challans';
import serviceRouter from './routes/service';
import fuelRouter from './routes/fuel';
import bookingsRouter from './routes/bookings';
import driversRouter from './routes/drivers';
import tyresRouter from './routes/tyres';
import batteriesRouter from './routes/batteries';
import expensesRouter from './routes/expenses';
import paymentsRouter from './routes/payments';
import documentsRouter from './routes/documents';
import notificationsRouter from './routes/notifications';
import reportsRouter from './routes/reports';
import searchRouter from './routes/search';
import fleetsRouter from './routes/fleets';
import customersRouter from './routes/customers';
import auditLogsRouter from './routes/auditLogs';
import usersRouter from './routes/users';
import trackingRouter from './routes/tracking';
import driverTrackingRouter from './routes/driverTracking';
import uploadsRouter from './routes/uploads';
import { getLocalLanIPv4, getFrontendPublicUrl } from './utils/networkUtils';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS Configuration supporting LAN Mobile Access & FRONTEND_PUBLIC_URL
const lanIp = getLocalLanIPv4();
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, native agents)
    if (!origin) return callback(null, true);

    const configuredPublicUrl = process.env.FRONTEND_PUBLIC_URL?.trim().replace(/\/+$/, '');
    if (configuredPublicUrl && origin === configuredPublicUrl) {
      return callback(null, true);
    }

    // Localhost & Loopback
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Standard Private LAN IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Detected LAN IP
    if (lanIp && origin.includes(lanIp)) {
      return callback(null, true);
    }

    // Allow in development
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve Uploaded Vehicle & Driver Images
import { UPLOADS_ROOT } from './utils/storage';
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOADS_ROOT));

// Request logging in dev
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SmartFleet 360 REST API', timestamp: new Date().toISOString() });
});

// Mount Modular REST Endpoints
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/rto', rtoRouter);
app.use('/api/insurance', insuranceRouter);
app.use('/api/puc', pucRouter);
app.use('/api/fitness', fitnessRouter);
app.use('/api/permits', permitsRouter);
app.use('/api/road-tax', roadTaxRouter);
app.use('/api/fastag', fastagRouter);
app.use('/api/challans', challansRouter);
app.use('/api/service', serviceRouter);
app.use('/api/fuel', fuelRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/tyres', tyresRouter);
app.use('/api/batteries', batteriesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/search', searchRouter);
app.use('/api/fleets', fleetsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/users', usersRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/driver-location', trackingRouter);
app.use('/api/driver-tracking', driverTrackingRouter);
app.use('/api/uploads', uploadsRouter);

// Serve Static Frontend in Production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  }
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server & Background Automation
async function startServer() {
  try {
    await initDatabase();

    // Initial background scan
    await NotificationEngine.runEvaluation();

    // Automated periodic background evaluator (Runs every 10 minutes)
    setInterval(async () => {
      console.log('[Automation Engine] Running periodic compliance & expiry evaluation...');
      await NotificationEngine.runEvaluation();
    }, 10 * 60 * 1000);

    const server = http.createServer(app);
    LiveTrackingSocketService.initialize(server);

    server.listen(Number(PORT), '0.0.0.0', () => {
      const lanUrl = getFrontendPublicUrl();
      console.log(`====================================================`);
      console.log(`  SmartFleet 360 Backend API & WebSocket Server Running`);
      console.log(`  Local URL:        http://localhost:${PORT}`);
      console.log(`  LAN IP:           ${lanIp}`);
      console.log(`  Mobile Track URL: ${lanUrl}`);
      console.log(`  WebSocket URL:    ws://localhost:${PORT}/api/driver-tracking/socket`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
