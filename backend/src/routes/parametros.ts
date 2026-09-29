import { Router } from 'express';
import { crearParametro, obtenerParametros, actualizarParametro, inactivarParametro } from '../controllers/parametroController.js';
import { autenticar } from '../middleware/autenticar.js';

const router = Router();

router.get('/', obtenerParametros);
router.post('/', autenticar, crearParametro);
router.put('/:id', autenticar, actualizarParametro);
router.delete('/:id', autenticar, inactivarParametro);

export default router;
