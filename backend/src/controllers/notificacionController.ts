import { Request, Response } from 'express';
import { Notificacion } from '../models/Notificacion.js';
import type { RoleName } from '../models/Role.js';

export const listarNotificaciones = async (req: Request, res: Response): Promise<void> => {
  try {
    const notificaciones = await Notificacion.find({
      destinatarioRol: req.usuario?.rol as RoleName,
      activo: true,
    }).sort({ fechaCreacion: -1 }).limit(30).lean();
    res.status(200).json({ notificaciones });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar notificaciones', error });
  }
};