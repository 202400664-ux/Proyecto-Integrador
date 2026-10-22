import { Router } from 'express';
import { listarEventos } from '../controllers/eventosController.js';
import { autenticar, requiereRol } from '../middleware/autenticacion.js';

const router = Router();

router.use(autenticar, requiereRol('administrador', 'coordinador'));
router.get('/', listarEventos);

export default router;
