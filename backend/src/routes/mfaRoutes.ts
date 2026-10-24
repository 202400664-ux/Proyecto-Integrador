import { Router } from 'express';
import { enableMfa, setupMfa, verifyMfaLogin } from '../controllers/mfaController.js';
import { verifyTempToken } from '../middleware/verifyTempToken.js';

const router = Router();

router.post('/setup', verifyTempToken, setupMfa);
router.post('/enable', verifyTempToken, enableMfa);
router.post('/verify-login', verifyTempToken, verifyMfaLogin);

export default router;
