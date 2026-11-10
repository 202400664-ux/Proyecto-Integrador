import { Router } from 'express';
import { crearProveedor, obtenerProveedores, actualizarProveedor, inactivarProveedor } from '../controllers/proveedorController.js';
import { autenticar } from '../middleware/autenticar.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.use(autenticar);
router.post('/', checkPermission('proveedores'), crearProveedor);
router.get('/', checkPermission('proveedores', 'pedidos'), obtenerProveedores);
router.put('/:id', checkPermission('proveedores'), actualizarProveedor);
router.delete('/:id', checkPermission('proveedores'), inactivarProveedor);

export default router;
