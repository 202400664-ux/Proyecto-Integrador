import { Request, Response } from 'express';
import type { ClientSession } from 'mongoose';
import { Auditoria } from '../models/Auditoria.js';

interface RegistroAuditoriaInput {
  entidad: string;
  accion: string;
  detalle: string;
  usuario?: string;
}

export const registrarAuditoria = async ({
  entidad,
  accion,
  detalle,
  usuario = 'Sistema',
}: RegistroAuditoriaInput): Promise<void> => {
  const registro = new Auditoria({
    entidad,
    accion,
    detalle,
    usuario,
    fecha: new Date(),
  });
  await registro.save(session ? { session } : undefined);
};

export const obtenerAuditorias = async (_req: Request, res: Response): Promise<void> => {
  try {
    const auditorias = await Auditoria.find().sort({ fecha: -1 }).limit(200);
    res.status(200).json({ auditorias });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar la auditoría', error });
  }
};
