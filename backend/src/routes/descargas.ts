import { Router } from 'express';
import { finalizarDescarga, iniciarDescarga, listarDescargas } from '../controllers/descargaController.js';
import { autenticar, requiereRol } from '../middleware/autenticacion.js';

const router = Router();
router.use(autenticar);
router.get('/activas', listarDescargas);
router.post('/iniciar', requiereRol('administrador', 'coordinador', 'operador'), iniciarDescarga);
router.post('/finalizar', requiereRol('administrador', 'coordinador', 'operador'), finalizarDescarga);
export default router;