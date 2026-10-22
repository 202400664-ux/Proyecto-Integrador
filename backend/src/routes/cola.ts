import { Router } from 'express';
import { asignarDesdeCola, obtenerCola, reevaluarColaController } from '../controllers/colaController.js';
import { autenticar, requiereRol } from '../middleware/autenticacion.js';

const router = Router();
router.use(autenticar);
router.get('/', obtenerCola);
router.post('/asignar', requiereRol('administrador', 'coordinador', 'operador'), asignarDesdeCola);
router.post('/reevaluar', requiereRol('administrador', 'coordinador', 'operador'), reevaluarColaController);
export default router;