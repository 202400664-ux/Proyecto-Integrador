import { Router } from 'express';
import { crearProveedor, obtenerProveedores, actualizarProveedor, inactivarProveedor } from '../controllers/proveedorController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.post('/', autenticar, crearProveedor);
router.get('/', obtenerProveedores);
router.put('/:id', autenticar, autorizar('administrador', 'coordinador'), actualizarProveedor);
router.delete('/:id', autenticar, autorizar('administrador', 'coordinador'), inactivarProveedor);

export default router;