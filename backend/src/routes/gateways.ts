import { Router } from 'express';
import { actualizarGateway, crearGateway, inactivarGateway, listarGateways, listarGatewaysInactivos, reactivarGateway } from '../controllers/gatewayController.js';
import { autenticar } from '../middleware/autenticacion.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.use(autenticar);
router.get('/', checkPermission('gateways', 'descargas'), listarGateways);
router.get('/disponibilidad', checkPermission('gateways', 'descargas'), listarGateways);
router.get('/inactivos', checkPermission('gateways'), listarGatewaysInactivos);
router.post('/', checkPermission('gateways'), crearGateway);
router.put('/:id', checkPermission('gateways'), actualizarGateway);
router.patch('/:id/reactivar', checkPermission('gateways'), reactivarGateway);
router.delete('/:id', checkPermission('gateways'), inactivarGateway);

export default router;
