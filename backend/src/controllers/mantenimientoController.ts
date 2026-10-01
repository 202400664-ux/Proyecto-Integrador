import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Mantenimiento } from '../models/Mantenimiento.js';
import { Proveedor } from '../models/Proveedor.js';
import { registrarAuditoria } from './auditoriaController.js';

export const crearMantenimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      numeroOrden,
      proveedorId,
      titulo,
      descripcion,
      tipo,
      estado,
      responsable,
      fechaProgramada,
      observaciones,
    } = req.body;

    if (!String(numeroOrden ?? '').trim() || !titulo || !descripcion || !tipo || !responsable || !fechaProgramada) {
      res.status(400).json({ mensaje: 'Faltan datos obligatorios para registrar el mantenimiento' });
      return;
    }

    if (!['preventivo', 'correctivo', 'predictivo'].includes(tipo)) {
      res.status(400).json({ mensaje: 'El tipo de mantenimiento no es válido' });
      return;
    }

    const fecha = new Date(fechaProgramada);
    if (!Number.isFinite(fecha.getTime())) {
      res.status(400).json({ mensaje: 'La fecha programada no es válida' });
      return;
    }

    if (!isValidObjectId(proveedorId)) {
      res.status(400).json({ mensaje: 'El ID del proveedor no es válido' });
      return;
    }

    const proveedor = await Proveedor.findOne({
      _id: proveedorId,
      activo: true,
      estado: 'activo',
    });
    if (!proveedor) {
      res.status(400).json({ mensaje: 'El proveedor indicado no existe o está inactivo' });
      return;
    }

    const mantenimiento = await Mantenimiento.create({
      numeroOrden,
      proveedorId: proveedor._id,
      titulo,
      descripcion,
      tipo,
      estado: estado || 'pendiente',
      responsable,
      fechaProgramada: fecha,
      observaciones,
      usuarioCreacion: req.usuarioAutenticado!.nombreCompleto,
      usuarioActualizacion: req.usuarioAutenticado!.nombreCompleto,
    });

    await registrarAuditoria({
      entidad: 'Mantenimiento',
      accion: 'crear',
      detalle: `Se registró la orden ${mantenimiento.numeroOrden} para ${mantenimiento.titulo}`,
      usuario: req.usuarioAutenticado!.nombreCompleto,
    });

    res.status(201).json({
      mensaje: 'Mantenimiento registrado correctamente',
      mantenimiento,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un mantenimiento con ese número de orden' });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ mensaje: error.message });
      return;
    }
    console.error('Error al registrar mantenimiento:', error);
    res.status(500).json({ mensaje: 'Error al registrar el mantenimiento', error });
  }
};

export const obtenerMantenimientos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const mantenimientos = await Mantenimiento.find({ activo: true })
      .populate('proveedorId')
      .sort({ fechaProgramada: 1 });
    res.status(200).json({ mantenimientos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar los mantenimientos', error });
  }
};
