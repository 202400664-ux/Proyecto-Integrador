import { Router } from 'express';
import { actualizarGateway, crearGateway, inactivarGateway, listarGateways, listarGatewaysInactivos, reactivarGateway } from '../controllers/gatewayController.js';
import { autenticar, requiereRol } from '../middleware/autenticacion.js';

const router = Router();

router.use(autenticar);
router.get('/', listarGateways);
router.get('/disponibilidad', listarGateways);
router.get('/inactivos', requiereRol('administrador'), listarGatewaysInactivos);
router.post('/', requiereRol('administrador'), crearGateway);
router.put('/:id', requiereRol('administrador'), actualizarGateway);
router.patch('/:id/reactivar', requiereRol('administrador'), reactivarGateway);
router.delete('/:id', requiereRol('administrador'), inactivarGateway);

export default router;