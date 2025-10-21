import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './src/config/db';
import authRoutes from './src/routes/auth.routes';
import adminRoutes from './src/routes/admin.routes';
import doctorRoutes from './src/routes/doctor.routes'; // Make sure this import is correct
import appointmentRoutes from './src/routes/appointment.routes';
import errorMiddleware from './src/middlewares/error.middleware';
import publicRoutes from './src/routes/public.routes';
import voiceRoutes from './src/routes/voice.routes';
import availabilityRoutes from './src/routes/availability.routes';

const app = express();

// Database connection
connectDB();

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://healthcare-frontend-zeta.vercel.app',
    'https://healthcare-frontend-zeta.vercel.app/',
    'https://*.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes - MAKE SURE THESE ARE IN THE RIGHT ORDER
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes); // This should create /api/doctors endpoint
app.use('/api/appointments', appointmentRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/availability', availabilityRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Handle 404 errors - THIS SHOULD BE AFTER ALL ROUTES
app.use('/api/*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.originalUrl} not found` 
  });
});
app.options('*', cors());
// Error handling middleware
app.use(errorMiddleware);

export default app;