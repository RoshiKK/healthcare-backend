import { Router } from 'express';
import { getPublicDoctors } from '../controllers/public.controller';

const router = Router();

// This should create the endpoint: /api/public/doctors
router.get('/doctors', getPublicDoctors);

export default router;