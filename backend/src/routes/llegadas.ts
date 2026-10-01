import { Router } from 'express';
import { registrarLlegada } from '../controllers/llegadasController.js';
import { autenticar } from '../middleware/autenticar.js';

const router = Router();

router.post('/', autenticar, registrarLlegada);

export default router;