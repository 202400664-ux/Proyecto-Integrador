import { Router } from 'express';
import { actualizarRol, crearRol, desactivarRol, listarRoles } from '../controllers/rolController.js';
import { autenticar } from '../middleware/autenticar.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.use(autenticar);
router.get('/', checkPermission('roles', 'usuarios'), listarRoles);
router.post('/', checkPermission('roles'), crearRol);
router.put('/:id', checkPermission('roles'), actualizarRol);
router.delete('/:id', checkPermission('roles'), desactivarRol);

export default router;
