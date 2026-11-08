import { Router } from 'express';
import { crearPedido, obtenerPedidos, actualizarPedido, cancelarPedido } from '../controllers/pedidoController.js';
import { autenticar } from '../middleware/autenticar.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.use(autenticar);
router.post('/', checkPermission('pedidos'), crearPedido);
router.get('/', checkPermission('pedidos', 'cola', 'descargas', 'gateways'), obtenerPedidos);
router.put('/:id', checkPermission('pedidos'), actualizarPedido);
router.delete('/:id', checkPermission('pedidos'), cancelarPedido);

export default router;
