import { Router } from 'express';
import { crearMantenimiento, obtenerMantenimientos } from '../controllers/mantenimientoController.js';
import { autenticar } from '../middleware/autenticar.js';

const router = Router();

router.get('/', obtenerMantenimientos);
router.post('/', autenticar, crearMantenimiento);

export default router;
