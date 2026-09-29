import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Usuario } from './models/Usuario.js';
import { Role, type RoleName } from './models/Role.js';

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

    const roles = await Promise.all(
      rolesBase.map(({ nombre, descripcion }) =>
        Role.findOneAndUpdate(
          { nombre },
          { $set: { descripcion } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
      )
    );
    const rolesPorNombre = new Map(roles.map((role) => [role.nombre, role]));

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
      const rol = rolesPorNombre.get(usuario.rol);
      if (!rol) {
        throw new Error(`Rol no encontrado: ${usuario.rol}`);
      }

      let usuarioPrueba = await Usuario.findOne({ email: usuario.email });
      if (!usuarioPrueba) {
        usuarioPrueba = new Usuario({ email: usuario.email, password: '123456' });
      }
      usuarioPrueba.nombres = usuario.nombres;
      usuarioPrueba.apellidosCompleto = usuario.apellidosCompleto;
      usuarioPrueba.password = '123456';
      usuarioPrueba.roles = [rol._id];
      usuarioPrueba.estado = 'activo';

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