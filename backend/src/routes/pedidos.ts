import { Router } from 'express';
import { crearPedido, obtenerPedidos, actualizarPedido, cancelarPedido } from '../controllers/pedidoController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.post('/', autenticar, crearPedido);
router.get('/', obtenerPedidos);
router.put('/:id', autenticar, autorizar('administrador', 'coordinador'), actualizarPedido);
router.delete('/:id', autenticar, autorizar('administrador', 'coordinador'), cancelarPedido);

export default router;