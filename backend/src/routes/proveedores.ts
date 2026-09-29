import { Router } from 'express';
import { crearProveedor, obtenerProveedores, actualizarProveedor, inactivarProveedor } from '../controllers/proveedorController.js';
import { autenticar } from '../middleware/autenticar.js';

const router = Router();

router.post('/', autenticar, crearProveedor);
router.get('/', obtenerProveedores);
router.put('/:id', autenticar, actualizarProveedor);
router.delete('/:id', autenticar, inactivarProveedor);

export default router;