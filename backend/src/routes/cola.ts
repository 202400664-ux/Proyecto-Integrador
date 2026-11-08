import { Router } from 'express';
import { asignarDesdeCola, obtenerCola, reevaluarColaController } from '../controllers/colaController.js';
import { autenticar } from '../middleware/autenticacion.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();
router.use(autenticar, checkPermission('cola', 'descargas', 'gateways'));
router.get('/', obtenerCola);
router.post('/asignar', asignarDesdeCola);
router.post('/reevaluar', reevaluarColaController);
export default router;
