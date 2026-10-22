import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import proveedoresRoutes from './routes/proveedores.js';
import pedidosRoutes from './routes/pedidos.js';
import llegadasRoutes from './routes/llegadas.js';
import mantenimientosRoutes from './routes/mantenimientos.js';
import auditoriaRoutes from './routes/auditoria.js';
import parametrosRoutes from './routes/parametros.js';
import gatewaysRoutes from './routes/gateways.js';
import colaRoutes from './routes/cola.js';
import descargasRoutes from './routes/descargas.js';
import { inicializarGateways } from './controllers/gatewayController.js';
import { autenticar, requiereRol } from './middleware/autenticacion.js';
import notificacionesRoutes from './routes/notificaciones.js';
import eventosRoutes from './routes/eventos.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sprint0auth';

app.use(cors());
app.use(express.json());

// 1. Conectar a MongoDB
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    await inicializarGateways();
    console.log('✅ Conectado a MongoDB correctamente');
  })
  .catch((err) => console.error('❌ Error al conectar con MongoDB:', err));

// 2. Registrar las rutas
app.use('/api/auth', authRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/llegadas', autenticar, requiereRol('administrador', 'coordinador', 'operador'), llegadasRoutes);
app.use('/api/mantenimientos', mantenimientosRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/parametros', parametrosRoutes);
app.use('/api/gateways', gatewaysRoutes);
app.use('/api/cola', colaRoutes);
app.use('/api/descargas', descargasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});