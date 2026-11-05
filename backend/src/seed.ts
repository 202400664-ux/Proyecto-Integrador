import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Usuario } from './models/Usuario.js';
import { Role, type RoleName } from './models/Role.js';
import { Parametro } from './models/Parametro.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sprint0auth';

const crearUsuarioSemilla = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Conectado a MongoDB...');

    const rolesBase: Array<{ nombre: RoleName; descripcion: string }> = [
      { nombre: 'administrador', descripcion: 'Acceso total al sistema' },
      { nombre: 'coordinador', descripcion: 'Gestion operativa y supervision' },
      { nombre: 'operador', descripcion: 'Acceso limitado a operaciones diarias' },
    ];

    const roles = [];
    for (const roleBase of rolesBase) {
      const role = await Role.findOne({ nombre: roleBase.nombre }) ?? await Role.create(roleBase);
      roles.push(role);
    }
    const rolesPorNombre = new Map(roles.map((role) => [role.nombre, role]));

    const parametrosHorario = [
      { clave: 'numero_equipo', valor: process.env.EQUIPO_NUMERO || '04', descripcion: 'Número del equipo para generar pedidos correlativos' },
      { clave: 'horario_inicio_operativo', valor: '07:00', descripcion: 'Hora de apertura del centro logístico' },
      { clave: 'horario_fin_operativo', valor: '17:00', descripcion: 'Hora de cierre del centro logístico' },
      { clave: 'tolerancia_anticipado_minutos', valor: '15', descripcion: 'RN-04: minutos de tolerancia antes del inicio de la ventana' },
      { clave: 'tolerancia_tardio_minutos', valor: '15', descripcion: 'RN-04: minutos de tolerancia después del fin de la ventana' },
      { clave: 'tolerancia_ausente_minutos', valor: '30', descripcion: 'RN-05: minutos tras el fin de la ventana para marcar AUSENTE' },
    ];
    for (const parametroBase of parametrosHorario) {
      const existente = await Parametro.findOne({ clave: parametroBase.clave });
      if (!existente) {
        await Parametro.create({ ...parametroBase, usuarioCreacion: 'Semilla', usuarioActualizacion: 'Semilla' });
      }
    }

    const usuariosPrueba: Array<{
      nombres: string;
      apellidosCompleto: string;
      email: string;
      rol: RoleName;
    }> = [
      { nombres: 'Admin', apellidosCompleto: 'De Prueba', email: 'admin@test.com', rol: 'administrador' },
      { nombres: 'Coordinador', apellidosCompleto: 'De Prueba', email: 'coordinador@test.com', rol: 'coordinador' },
      { nombres: 'Operador', apellidosCompleto: 'De Prueba', email: 'operador@test.com', rol: 'operador' },
    ];

    for (const usuario of usuariosPrueba) {
      const existente = await Usuario.findOne({ email: usuario.email });
      if (existente) {
        console.log(`  ${usuario.email} | Ya existe, se conservó sin cambios`);
        continue;
      }

      const rol = rolesPorNombre.get(usuario.rol);
      if (!rol) {
        throw new Error(`Rol no encontrado: ${usuario.rol}`);
      }

      const usuarioPrueba = new Usuario({
        nombres: usuario.nombres,
        apellidosCompleto: usuario.apellidosCompleto,
        email: usuario.email,
        password: '123456',
        roles: [rol._id],
        estado: 'activo',
      });

      await usuarioPrueba.save();
      console.log(`  ${usuario.email} | Contraseña: 123456 | Rol: ${usuario.rol}`);
    }

    console.log('✅ Usuarios de prueba creados exitosamente');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error al insertar usuario semilla:', error);
    process.exit(1);
  }
};

crearUsuarioSemilla();