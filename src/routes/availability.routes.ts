import { Router } from 'express';
import { setDoctorAvailability, getDoctorAvailability } from '../controllers/availability.controller';
import authMiddleware from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', setDoctorAvailability);
router.get('/', getDoctorAvailability);

export default router;