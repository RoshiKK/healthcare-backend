import { Router } from 'express';
import { 
  getAllDoctors, 
  createDoctor, 
  updateDoctorStatus, 
  getAdminStats,
  updateDoctor,
  deleteDoctor
} from '../controllers/admin.controller';
import authMiddleware, { adminMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/doctors', getAllDoctors);
router.post('/doctors', createDoctor);
router.patch('/doctors/:doctorId/status', updateDoctorStatus);
router.patch('/doctors/:doctorId', updateDoctor);
router.delete('/doctors/:doctorId', deleteDoctor);
router.get('/stats', getAdminStats);

export default router;