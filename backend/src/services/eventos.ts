import { Types } from 'mongoose';
import { Evento, type RegistrarEventoInput } from '../models/Evento.js';

export async function registrarEvento({
  usuarioId,
  usuario,
  accion,
  detalles,
  pedidoId,
  session,
}: RegistrarEventoInput): Promise<void> {
  if (!Types.ObjectId.isValid(usuarioId)) {
    throw new Error('No se puede registrar el evento sin un usuario autenticado válido');
  }

  await Evento.create(
    [{
      usuarioId: new Types.ObjectId(usuarioId),
      ...(pedidoId ? { pedidoId: new Types.ObjectId(pedidoId) } : {}),
      accion,
      detalles,
      fechaHora: new Date(),
      usuarioCreacion: usuario,
    }],
    session ? { session } : undefined
  );
}
