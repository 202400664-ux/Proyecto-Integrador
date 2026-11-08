import { Router } from 'express';
import { crearParametro, obtenerParametros, actualizarParametro, inactivarParametro } from '../controllers/parametroController.js';
import { autenticar, autorizar } from '../middleware/autenticar.js';

const router = Router();

router.get('/', obtenerParametros);
router.post('/', autenticar, autorizar('administrador'), crearParametro);
router.put('/:id', autenticar, autorizar('administrador'), actualizarParametro);
router.delete('/:id', autenticar, autorizar('administrador'), inactivarParametro);

export default router;
