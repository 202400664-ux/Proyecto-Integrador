import { Router } from 'express';
import { crearPedido, obtenerPedidos, actualizarPedido, cancelarPedido } from '../controllers/pedidoController.js';
import { autenticar } from '../middleware/autenticar.js';

const router = Router();

router.post('/', autenticar, crearPedido);
router.get('/', obtenerPedidos);
router.put('/:id', autenticar, actualizarPedido);
router.delete('/:id', autenticar, cancelarPedido);

export default router;