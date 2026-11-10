import type { Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { Role, type IRole } from '../models/Role.js';
import { Usuario, type IUsuario } from '../models/Usuario.js';
import { registrarEvento } from '../services/eventos.js';

type UsuarioConRol = Omit<Pick<IUsuario,
  '_id' | 'nombres' | 'apellidosCompleto' | 'email' | 'estado' | 'activo'
  | 'mfaObligatorio' | 'twoFactorEnabled' | 'fechaCreacion' | 'fechaActualizacion'
>, 'roles'> & { roles: Array<Types.ObjectId | IRole> };

function respuestaUsuario(usuario: UsuarioConRol) {
  return {
    id: String(usuario._id),
    nombres: usuario.nombres,
    apellidosCompleto: usuario.apellidosCompleto,
    email: usuario.email,
    roles: usuario.roles.flatMap((rol) => 'nombreRol' in rol
      ? [{ _id: String(rol._id), nombreRol: rol.nombreRol, activo: rol.activo }]
      : []),
    activo: usuario.estado !== 'inactivo' && usuario.activo !== false,
    mfaObligatorio: usuario.mfaObligatorio,
    twoFactorEnabled: usuario.twoFactorEnabled,
    fechaCreacion: usuario.fechaCreacion,
    fechaActualizacion: usuario.fechaActualizacion,
  };
}

/** Devuelve los roles indicados solo si todos existen y están activos. */
async function rolesActivosPorId(valor: unknown): Promise<IRole[] | null> {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  if (!valor.every((id) => typeof id === 'string' && isValidObjectId(id))) return null;
  const ids = [...new Set(valor as string[])];
  const roles = await Role.find({ _id: { $in: ids }, activo: true });
  return roles.length === ids.length ? roles : null;
}

function registrarAsignacion(req: Request, usuario: IUsuario, roles: IRole[], rolesAnteriores: string[]): Promise<void> {
  const actor = req.usuarioAutenticado!;
  return registrarEvento({
    usuarioId: actor.id,
    usuario: actor.nombreCompleto,
    accion: 'ROL_ASIGNADO_USUARIO',
    detalles: {
      usuarioAfectadoId: String(usuario._id),
      email: usuario.email,
      roles: roles.map((rol) => rol.nombreRol),
      rolesAnteriores,
    },
  });
}

export async function listarUsuarios(_req: Request, res: Response): Promise<void> {
  const usuarios = await Usuario.find()
    .select('nombres apellidosCompleto email roles estado activo mfaObligatorio twoFactorEnabled fechaCreacion fechaActualizacion')
    .populate<{ roles: IRole[] }>({ path: 'roles', model: Role })
    .sort({ nombres: 1, apellidosCompleto: 1 });
  res.status(200).json(usuarios.map(respuestaUsuario));
}

export async function crearUsuario(req: Request, res: Response): Promise<void> {
  const { nombres, apellidosCompleto, email, password, roles, mfaObligatorio, activo = true } = req.body ?? {};
  if (
    typeof nombres !== 'string' || !nombres.trim()
    || typeof apellidosCompleto !== 'string' || !apellidosCompleto.trim()
    || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== 'string' || password.length < 8
    || typeof mfaObligatorio !== 'boolean'
    || typeof activo !== 'boolean'
  ) {
    res.status(400).json({ mensaje: 'Complete los datos del usuario; la contraseña debe tener al menos 8 caracteres' });
    return;
  }

  const rolesAsignados = await rolesActivosPorId(roles);
  if (!rolesAsignados) {
    res.status(400).json({ mensaje: 'Seleccione al menos un rol activo válido' });
    return;
  }

  let usuario: IUsuario;
  try {
    usuario = new Usuario({
      nombres: nombres.trim(),
      apellidosCompleto: apellidosCompleto.trim(),
      email: email.trim().toLowerCase(),
      password,
      roles: rolesAsignados.map((rol) => rol._id),
      estado: activo ? 'activo' : 'inactivo',
      activo,
      mfaObligatorio,
      usuarioCreacion: req.usuarioAutenticado?.nombreCompleto ?? 'Sistema',
      usuarioActualizacion: req.usuarioAutenticado?.nombreCompleto ?? 'Sistema',
    });
    await usuario.save();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo electrónico' });
      return;
    }
    throw error;
  }

  try {
    await registrarAsignacion(req, usuario, rolesAsignados, []);
  } catch (error) {
    await Usuario.deleteOne({ _id: usuario._id });
    throw error;
  }
  await usuario.populate('roles');
  res.status(201).json(respuestaUsuario(usuario));
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

  const { nombres, apellidosCompleto, email, password, roles, activo, mfaObligatorio } = req.body ?? {};
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

  const idsAnteriores = usuario.roles.map(String);
  let rolesAsignados: IRole[] | null = null;
  if (roles !== undefined) {
    rolesAsignados = await rolesActivosPorId(roles);
    if (!rolesAsignados) {
      res.status(400).json({ mensaje: 'Seleccione al menos un rol activo válido' });
      return;
    }
    usuario.roles = rolesAsignados.map((rol) => rol._id);
  }
  const rolesCambiaron = rolesAsignados !== null
    && [...usuario.roles.map(String)].sort().join() !== [...idsAnteriores].sort().join();

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
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo electrónico' });
      return;
    }
    throw error;
  }

  if (rolesCambiaron && rolesAsignados) {
    try {
      const anteriores = await Role.find({ _id: { $in: idsAnteriores } }).select('nombreRol');
      await registrarAsignacion(req, usuario, rolesAsignados, anteriores.map((rol) => rol.nombreRol));
    } catch (error) {
      usuario.roles = idsAnteriores.map((id) => new Types.ObjectId(id));
      await usuario.save();
      throw error;
    }
  }
  await usuario.populate('roles');
  res.status(200).json(respuestaUsuario(usuario));
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
