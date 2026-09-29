import { Request, Response } from 'express';
import { Auditoria } from '../models/Auditoria.js';

interface RegistroAuditoriaInput {
  entidad: string;
  accion: string;
  detalle: string;
  usuario: string;
}

export const registrarAuditoria = async ({
  entidad,
  accion,
  detalle,
  usuario,
}: RegistroAuditoriaInput): Promise<void> => {
  await Auditoria.create({
    entidad,
    accion,
    detalle,
    usuario,
    fecha: new Date(),
  });
};

export const obtenerAuditorias = async (_req: Request, res: Response): Promise<void> => {
  try {
    const auditorias = await Auditoria.find({ activo: true }).sort({ fecha: -1 }).limit(200);
    res.status(200).json({ auditorias });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar la auditoría', error });
  }
};
