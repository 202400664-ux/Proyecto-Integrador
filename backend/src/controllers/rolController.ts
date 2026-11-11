import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Role, esRolBase, type IRole } from '../models/Role.js';
import { Usuario } from '../models/Usuario.js';
import { registrarEvento } from '../services/eventos.js';
import { normalizarPermisos } from '../services/permisos.js';

const FORMATO_NOMBRE_ROL = /^\p{L}[\p{L}\s.-]{2,49}$/u;

function esClaveDuplicada(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function limpiarNombre(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

function resumenRol(rol: IRole) {
  return { rolId: String(rol._id), nombreRol: rol.nombreRol, permisos: [...rol.permisos], activo: rol.activo };
}

export async function listarRoles(req: Request, res: Response): Promise<void> {
  const { activo } = req.query;
  if (activo !== undefined && activo !== 'true' && activo !== 'false') {
    res.status(400).json({ mensaje: 'El filtro activo debe ser true o false' });
    return;
  }
  const filtro = activo === undefined ? {} : { activo: activo === 'true' };
  const roles = await Role.find(filtro).sort({ nombreRol: 1 }).collation({ locale: 'es', strength: 2 });
  res.status(200).json({ roles });
}

export async function crearRol(req: Request, res: Response): Promise<void> {
  const actor = req.usuarioAutenticado!;
  const { nombreRol, descripcion, permisos } = req.body ?? {};
  const nombre = limpiarNombre(nombreRol);
  if (!FORMATO_NOMBRE_ROL.test(nombre)) {
    res.status(400).json({ mensaje: 'El nombre del rol debe tener entre 3 y 50 letras' });
    return;
  }
  if (typeof descripcion !== 'string' || !descripcion.trim()) {
    res.status(400).json({ mensaje: 'La descripción del rol es obligatoria' });
    return;
  }
  const modulos = normalizarPermisos(permisos);
  if (!modulos || modulos.length === 0) {
    res.status(400).json({ mensaje: 'Seleccione al menos un permiso válido del sistema' });
    return;
  }

  let rol: IRole;
  try {
    rol = await Role.create({
      nombreRol: nombre,
      descripcion: descripcion.trim(),
      permisos: modulos,
      activo: true,
      usuarioCreacion: actor.nombreCompleto,
      usuarioActualizacion: actor.nombreCompleto,
    });
  } catch (error) {
    if (esClaveDuplicada(error)) {
      res.status(409).json({ mensaje: `Ya existe un rol llamado "${nombre}". Si está inactivo, reactívelo desde el listado.` });
      return;
    }
    throw error;
  }

  try {
    await registrarEvento({ usuarioId: actor.id, usuario: actor.nombreCompleto, accion: 'ROL_CREADO', detalles: resumenRol(rol) });
  } catch (error) {
    await Role.deleteOne({ _id: rol._id });
    throw error;
  }
  res.status(201).json({ mensaje: 'Rol creado correctamente', rol });
}

export async function actualizarRol(req: Request, res: Response): Promise<void> {
  const actor = req.usuarioAutenticado!;
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ mensaje: 'El identificador del rol no es válido' });
    return;
  }
  const rol = await Role.findById(req.params.id);
  if (!rol) {
    res.status(404).json({ mensaje: 'Rol no encontrado' });
    return;
  }

  const anterior = resumenRol(rol);
  const descripcionAnterior = rol.descripcion;
  const usuarioAnterior = rol.usuarioActualizacion;
  const { nombreRol, descripcion, permisos, activo } = req.body ?? {};

  if (nombreRol !== undefined) {
    const nombre = limpiarNombre(nombreRol);
    if (!FORMATO_NOMBRE_ROL.test(nombre)) {
      res.status(400).json({ mensaje: 'El nombre del rol debe tener entre 3 y 50 letras' });
      return;
    }
    if (esRolBase(rol.nombreRol) && nombre !== rol.nombreRol) {
      res.status(400).json({ mensaje: 'Los roles base del sistema no se pueden renombrar' });
      return;
    }
    rol.nombreRol = nombre;
  }
  if (descripcion !== undefined) {
    if (typeof descripcion !== 'string' || !descripcion.trim()) {
      res.status(400).json({ mensaje: 'La descripción del rol es obligatoria' });
      return;
    }
    rol.descripcion = descripcion.trim();
  }
  if (permisos !== undefined) {
    const modulos = normalizarPermisos(permisos);
    if (!modulos || modulos.length === 0) {
      res.status(400).json({ mensaje: 'Seleccione al menos un permiso válido del sistema' });
      return;
    }
    if (rol.nombreRol === 'administrador' && [...modulos].sort().join() !== [...rol.permisos].sort().join()) {
      res.status(400).json({ mensaje: 'Los permisos del rol administrador no se pueden modificar' });
      return;
    }
    rol.permisos = modulos;
  }
  if (activo !== undefined) {
    // La baja pasa siempre por DELETE, que comprueba la integridad referencial.
    if (activo !== true) {
      res.status(400).json({ mensaje: 'Para desactivar un rol use la acción de baja lógica' });
      return;
    }
    rol.activo = true;
  }
  rol.usuarioActualizacion = actor.nombreCompleto;

  try {
    await rol.save();
  } catch (error) {
    if (esClaveDuplicada(error)) {
      res.status(409).json({ mensaje: `Ya existe un rol llamado "${rol.nombreRol}"` });
      return;
    }
    throw error;
  }

  try {
    await registrarEvento({
      usuarioId: actor.id,
      usuario: actor.nombreCompleto,
      accion: 'ROL_MODIFICADO',
      detalles: { anterior, nuevo: resumenRol(rol) },
    });
  } catch (error) {
    rol.nombreRol = anterior.nombreRol;
    rol.descripcion = descripcionAnterior;
    rol.permisos = anterior.permisos;
    rol.activo = anterior.activo;
    rol.usuarioActualizacion = usuarioAnterior;
    await rol.save();
    throw error;
  }
  res.status(200).json({ mensaje: 'Rol actualizado correctamente', rol });
}

export async function desactivarRol(req: Request, res: Response): Promise<void> {
  const actor = req.usuarioAutenticado!;
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ mensaje: 'El identificador del rol no es válido' });
    return;
  }
  const rol = await Role.findOne({ _id: req.params.id, activo: true });
  if (!rol) {
    res.status(404).json({ mensaje: 'Rol no encontrado o ya inactivo' });
    return;
  }
  if (esRolBase(rol.nombreRol)) {
    res.status(400).json({ mensaje: 'Los roles base del sistema no se pueden desactivar' });
    return;
  }

  const usuariosVinculados = await Usuario.countDocuments({
    roles: rol._id,
    activo: { $ne: false },
    estado: { $ne: 'inactivo' },
  });
  if (usuariosVinculados > 0) {
    res.status(409).json({
      mensaje: `No se puede desactivar el rol "${rol.nombreRol}": ${usuariosVinculados} usuario(s) activo(s) lo tienen asignado. Reasígnelos o desactívelos primero.`,
      usuariosVinculados,
    });
    return;
  }

  const usuarioAnterior = rol.usuarioActualizacion;
  rol.activo = false;
  rol.usuarioActualizacion = actor.nombreCompleto;
  await rol.save();

  try {
    await registrarEvento({ usuarioId: actor.id, usuario: actor.nombreCompleto, accion: 'ROL_DESACTIVADO', detalles: resumenRol(rol) });
  } catch (error) {
    rol.activo = true;
    rol.usuarioActualizacion = usuarioAnterior;
    await rol.save();
    throw error;
  }
  res.status(200).json({ mensaje: 'Rol desactivado correctamente', rol });
}
