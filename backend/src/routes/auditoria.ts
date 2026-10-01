import { Router } from 'express';
import { obtenerAuditorias } from '../controllers/auditoriaController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.get('/', autenticar, autorizar('administrador', 'coordinador'), obtenerAuditorias);

export default router;
