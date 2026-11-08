import { Router } from 'express';
import { actualizarUsuario, crearUsuario, listarUsuarios, restablecerMfaUsuario } from '../controllers/usuarioController.js';
import { autenticar } from '../middleware/autenticar.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

router.use(autenticar, checkPermission('usuarios'));
router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.patch('/:id', actualizarUsuario);
router.post('/:id/mfa/reset', restablecerMfaUsuario);

export default router;
