import { Router } from 'express';
import { 
  bookAppointment, 
  getAvailableSlots, 
  getPatientAppointments,
  cancelAppointment,
  rescheduleAppointment
} from '../controllers/appointment.controller';
import authMiddleware from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/availability', getAvailableSlots);
router.post('/', bookAppointment); // Main booking endpoint

// Protected routes
router.use(authMiddleware);
router.get('/patient', getPatientAppointments);
router.patch('/:appointmentId/cancel', cancelAppointment);
router.patch('/:appointmentId/reschedule', rescheduleAppointment);

export default router;