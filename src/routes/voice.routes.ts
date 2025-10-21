import { Router } from 'express';
import { 
  voiceBookAppointment, 
  initiateVoiceSession, 
  processVoiceCommand 
} from '../controllers/voice.controller';

const router = Router();

// Make sure these match what the frontend is calling
router.post('/book', voiceBookAppointment);
router.post('/session/initiate', initiateVoiceSession);
router.post('/process', processVoiceCommand);

export default router;