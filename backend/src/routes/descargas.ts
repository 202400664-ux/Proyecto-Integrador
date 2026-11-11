import { Router } from 'express';
import { finalizarDescarga, iniciarDescarga, listarDescargas } from '../controllers/descargaController.js';
import { autenticar } from '../middleware/autenticacion.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();
router.use(autenticar);
router.get('/activas', checkPermission('descargas', 'gateways'), listarDescargas);
router.post('/iniciar', checkPermission('descargas'), iniciarDescarga);
router.post('/finalizar', checkPermission('descargas'), finalizarDescarga);
export default router;
