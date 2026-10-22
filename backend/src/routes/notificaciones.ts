import { Router } from 'express';
import { listarNotificaciones } from '../controllers/notificacionController.js';
import { autenticar } from '../middleware/autenticacion.js';

const router = Router();
router.get('/', autenticar, listarNotificaciones);
export default router;