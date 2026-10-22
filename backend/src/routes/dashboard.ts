import { Router } from 'express';
import { obtenerKpis } from '../controllers/dashboardController.js';
import { autenticar, requiereRol } from '../middleware/autenticacion.js';

const router = Router();

router.get('/kpis', autenticar, requiereRol('administrador', 'coordinador'), obtenerKpis);

export default router;
