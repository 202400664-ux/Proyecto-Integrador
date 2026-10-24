import { Router } from 'express';
import { actualizarUsuario, crearUsuario, listarUsuarios } from '../controllers/usuarioController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.use(autenticar, autorizar('administrador'));
router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.patch('/:id', actualizarUsuario);

export default router;
