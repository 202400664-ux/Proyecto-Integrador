import type { Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { Role, type IRole, type RoleName } from '../models/Role.js';
import { Usuario, type IUsuario } from '../models/Usuario.js';

const rolesValidos: RoleName[] = ['administrador', 'coordinador', 'operador'];

type UsuarioConRol = Omit<Pick<IUsuario,
  '_id' | 'nombres' | 'apellidosCompleto' | 'email' | 'estado' | 'activo'
  | 'mfaObligatorio' | 'twoFactorEnabled' | 'fechaCreacion' | 'fechaActualizacion'
>, 'roles'> & { roles: Array<Types.ObjectId | IRole> };

function respuestaUsuario(usuario: UsuarioConRol) {
  const role = usuario.roles[0];
  return {
    id: String(usuario._id),
    nombres: usuario.nombres,
    apellidosCompleto: usuario.apellidosCompleto,
    email: usuario.email,
    rol: role && 'nombre' in role ? role.nombre : undefined,
    activo: usuario.estado !== 'inactivo' && usuario.activo !== false,
    mfaObligatorio: usuario.mfaObligatorio,
    twoFactorEnabled: usuario.twoFactorEnabled,
    fechaCreacion: usuario.fechaCreacion,
    fechaActualizacion: usuario.fechaActualizacion,
  };
}

function esRoleName(nombre: unknown): nombre is RoleName {
  return typeof nombre === 'string' && rolesValidos.includes(nombre as RoleName);
}

async function rolPorNombre(nombre: unknown): Promise<IRole | null> {
  if (!esRoleName(nombre)) return null;
  return Role.findOne({ nombre });
}

export async function listarUsuarios(_req: Request, res: Response): Promise<void> {
  const usuarios = await Usuario.find()
    .select('nombres apellidosCompleto email roles estado activo mfaObligatorio twoFactorEnabled fechaCreacion fechaActualizacion')
    .populate<{ roles: IRole[] }>({ path: 'roles', model: Role })
    .sort({ nombres: 1, apellidosCompleto: 1 });
  res.status(200).json(usuarios.map(respuestaUsuario));
}

export async function crearUsuario(req: Request, res: Response): Promise<void> {
  const { nombres, apellidosCompleto, email, password, rol, mfaObligatorio } = req.body ?? {};
  if (
    typeof nombres !== 'string' || !nombres.trim()
    || typeof apellidosCompleto !== 'string' || !apellidosCompleto.trim()
    || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== 'string' || password.length < 8
    || typeof mfaObligatorio !== 'boolean'
  ) {
    res.status(400).json({ mensaje: 'Complete los datos del usuario; la contraseña debe tener al menos 8 caracteres' });
    return;
  }

  const role = await rolPorNombre(rol);
  if (!role) {
    res.status(400).json({ mensaje: 'El rol seleccionado no es válido' });
    return;
  }

  try {
    const usuario = new Usuario({
      nombres: nombres.trim(),
      apellidosCompleto: apellidosCompleto.trim(),
      email: email.trim().toLowerCase(),
      password,
      roles: [role._id],
      estado: 'activo',
      activo: true,
      mfaObligatorio,
      usuarioCreacion: req.usuarioAutenticado?.nombreCompleto ?? 'Sistema',
      usuarioActualizacion: req.usuarioAutenticado?.nombreCompleto ?? 'Sistema',
    });
    await usuario.save();
    await usuario.populate('roles');
    res.status(201).json(respuestaUsuario(usuario));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo electrónico' });
      return;
    }
    throw error;
  }
}

export async function actualizarUsuario(req: Request, res: Response): Promise<void> {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ mensaje: 'El identificador del usuario no es válido' });
    return;
  }

  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) {
    res.status(404).json({ mensaje: 'Usuario no encontrado' });
    return;
  }

  const { nombres, apellidosCompleto, email, password, rol, activo, mfaObligatorio } = req.body ?? {};
  if (nombres !== undefined) {
    if (typeof nombres !== 'string' || !nombres.trim()) {
      res.status(400).json({ mensaje: 'El nombre es obligatorio' });
      return;
    }
    usuario.nombres = nombres.trim();
  }
  if (apellidosCompleto !== undefined) {
    if (typeof apellidosCompleto !== 'string' || !apellidosCompleto.trim()) {
      res.status(400).json({ mensaje: 'Los apellidos son obligatorios' });
      return;
    }
    usuario.apellidosCompleto = apellidosCompleto.trim();
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ mensaje: 'El correo electrónico no es válido' });
      return;
    }
    usuario.email = email.trim().toLowerCase();
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }
    usuario.password = password;
  }
  if (rol !== undefined) {
    const role = await rolPorNombre(rol);
    if (!role) {
      res.status(400).json({ mensaje: 'El rol seleccionado no es válido' });
      return;
    }
    usuario.roles = [role._id];
  }
  if (activo !== undefined) {
    if (typeof activo !== 'boolean') {
      res.status(400).json({ mensaje: 'El estado activo debe ser booleano' });
      return;
    }
    usuario.activo = activo;
    usuario.estado = activo ? 'activo' : 'inactivo';
  }
  if (mfaObligatorio !== undefined) {
    if (typeof mfaObligatorio !== 'boolean') {
      res.status(400).json({ mensaje: 'La configuración mfaObligatorio debe ser booleana' });
      return;
    }
    usuario.mfaObligatorio = mfaObligatorio;
  }
  usuario.usuarioActualizacion = req.usuarioAutenticado?.nombreCompleto ?? 'Sistema';

  try {
    await usuario.save();
    await usuario.populate('roles');
    res.status(200).json(respuestaUsuario(usuario));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo electrónico' });
      return;
    }
    throw error;
  }
}

export async function restablecerMfaUsuario(req: Request, res: Response): Promise<void> {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ mensaje: 'El identificador del usuario no es válido' });
    return;
  }

  const usuario = await Usuario.findById(req.params.id).select('+twoFactorSecret +twoFactorRecoveryCodes');
  if (!usuario) {
    res.status(404).json({ mensaje: 'Usuario no encontrado' });
    return;
  }

  usuario.twoFactorSecret = undefined;
  usuario.twoFactorEnabled = false;
  usuario.twoFactorRecoveryCodes = [];
  usuario.usuarioActualizacion = req.usuarioAutenticado?.nombreCompleto ?? 'Sistema';
  await usuario.save();

  res.status(200).json({
    mensaje: usuario.mfaObligatorio
      ? 'MFA restablecido. El usuario deberá enrolarse de nuevo en su próximo inicio de sesión.'
      : 'MFA restablecido. El usuario podrá iniciar sesión sin código mientras MFA no sea obligatorio.',
  });
}
