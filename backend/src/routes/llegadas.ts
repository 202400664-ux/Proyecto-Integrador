import { Router } from 'express';
import { registrarLlegada } from '../controllers/llegadasController.js';
import { autenticar } from '../middleware/autenticar.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.post('/', autenticar, checkPermission('cola'), registrarLlegada);

export default router;
