import dotenv from "dotenv";
dotenv.config();
import app from './app';
import { createAdminUser, createSampleDoctors } from './src/services/admin.service';
import mongoose from 'mongoose';

const PORT = process.env.PORT || 5000;

// Connection event listeners
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Start server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    await createAdminUser();
    await createSampleDoctors();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

startServer();
