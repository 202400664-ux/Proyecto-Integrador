import { Request, Response } from 'express';
import { Mantenimiento } from '../models/Mantenimiento.js';
import { registrarAuditoria } from './auditoriaController.js';
import { validarNombreCompleto } from '../utils/usuario.js';

export const crearMantenimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      numeroOrden,
      titulo,
      descripcion,
      tipo,
      estado,
      responsable,
      fechaProgramada,
      observaciones,
      usuarioCreacion,
    } = req.body;
    const nombreUsuario = validarNombreCompleto(usuarioCreacion);

    if (!numeroOrden || !titulo || !descripcion || !tipo || !responsable || !fechaProgramada || !nombreUsuario) {
      res.status(400).json({ mensaje: 'Faltan datos obligatorios o el nombre completo del usuario' });
      return;
    }

    const mantenimiento = await Mantenimiento.create({
      numeroOrden,
      titulo,
      descripcion,
      tipo,
      estado: estado || 'pendiente',
      responsable,
      fechaProgramada: new Date(fechaProgramada),
      observaciones,
      usuarioCreacion: nombreUsuario,
      usuarioActualizacion: nombreUsuario,
    });

    await registrarAuditoria({
      entidad: 'Mantenimiento',
      accion: 'crear',
      detalle: `Se registró la orden ${mantenimiento.numeroOrden} para ${mantenimiento.titulo}`,
      usuario: nombreUsuario,
    });

    res.status(201).json({
      mensaje: 'Mantenimiento registrado correctamente',
      mantenimiento,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar el mantenimiento', error });
  }
};

export const obtenerMantenimientos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const mantenimientos = await Mantenimiento.find({ activo: true }).sort({ fechaProgramada: 1 });
    res.status(200).json({ mantenimientos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar los mantenimientos', error });
  }
};
