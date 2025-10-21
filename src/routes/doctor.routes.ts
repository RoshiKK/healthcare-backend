import { Router } from 'express';
import { getDoctorById, getAllDoctors } from '../controllers/doctor.controller';

const router = Router();

// Add debug middleware
router.use((req, res, next) => {
  console.log(`Doctor route hit: ${req.method} ${req.path}`, req.query);
  next();
});

// GET /api/doctors - Get all doctors (public endpoint)
router.get('/', getAllDoctors);

// GET /api/doctors/:doctorId - Get specific doctor
router.get('/:doctorId', getDoctorById);

export default router;