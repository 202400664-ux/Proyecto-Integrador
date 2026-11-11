import { Router } from 'express';
import { obtenerKpis } from '../controllers/dashboardController.js';
import { autenticar } from '../middleware/autenticacion.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.get('/kpis', autenticar, checkPermission('kpis'), obtenerKpis);

export default router;
