import { Router } from 'express';
import { finalizarDescarga, iniciarDescarga, obtenerDescargasActivas } from '../controllers/descargaController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.use(autenticar);
router.get('/', obtenerDescargasActivas);
router.post('/iniciar', autorizar('administrador', 'coordinador', 'operador'), iniciarDescarga);
router.post('/finalizar', autorizar('administrador', 'coordinador', 'operador'), finalizarDescarga);

export default router;