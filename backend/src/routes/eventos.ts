import { Router } from 'express';
import { listarEventos } from '../controllers/eventosController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.use(autenticar, autorizar('administrador', 'coordinador'));
router.get('/', listarEventos);

export default router;
