import { Router } from 'express';
import { actualizarGateway, crearGateway, eliminarGateway, obtenerGateways } from '../controllers/gatewayController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.use(autenticar);
router.get('/', obtenerGateways);
router.post('/', autorizar('administrador'), crearGateway);
router.put('/:id', autorizar('administrador'), actualizarGateway);
router.delete('/:id', autorizar('administrador'), eliminarGateway);

export default router;