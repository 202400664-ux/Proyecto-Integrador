import { Notificacion } from '../models/Notificacion.js';
import type { RoleName } from '../models/Role.js';

export async function notificarRol(
  destinatarioRol: RoleName,
  titulo: string,
  mensaje: string,
  entidad: string,
  entidadId?: string
): Promise<void> {
  await Notificacion.create({ destinatarioRol, titulo, mensaje, entidad, entidadId, activo: true, leida: false });
}