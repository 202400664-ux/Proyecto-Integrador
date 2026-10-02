import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Gateway } from '../models/Gateway.js';
import { registrarAuditoria } from './auditoriaController.js';

const tipoPorNumero = (numero: number) => numero === 5 ? 'construcción' : 'general';

function validarConfiguracion(numero: number, tipo: string): string | null {
  if (!Number.isInteger(numero) || numero < 1 || numero > 5) return 'El número de gateway debe estar entre 1 y 5';
  if (!['general', 'construcción'].includes(tipo)) return 'El tipo de carga debe ser "general" o "construcción"';
  if (tipo !== tipoPorNumero(numero)) {
    return numero === 5
      ? 'El Gateway 5 está reservado para carga de construcción'
      : 'Los Gateways 1 al 4 están reservados para carga general';
  }
  return null;
}

export const obtenerGateways = async (_req: Request, res: Response): Promise<void> => {
  try {
    const gateways = await Gateway.find({ activo: true }).sort({ numeroGateway: 1 });
    res.status(200).json({ gateways });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar los gateways', error });
  }
};

export const crearGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroGateway = Number(req.body.numeroGateway);
    const tipoCargaPermitida = req.body.tipoCargaPermitida;
    const errorConfiguracion = validarConfiguracion(numeroGateway, tipoCargaPermitida);
    if (errorConfiguracion) {
      res.status(400).json({ mensaje: errorConfiguracion });
      return;
    }
    if (req.body.estado === 'OCUPADO') {
      res.status(400).json({ mensaje: 'El estado OCUPADO solo se asigna al iniciar una descarga' });
      return;
    }
    const actor = req.usuarioAutenticado!.nombreCompleto;
    const gateway = await Gateway.create({
      numeroGateway,
      tipoCargaPermitida,
      estado: req.body.estado ?? 'LIBRE',
      usuarioCreacion: actor,
      usuarioActualizacion: actor,
    });
    await registrarAuditoria({ entidad: 'Gateway', accion: 'crear', detalle: `Se creó el Gateway ${numeroGateway}`, usuario: actor });
    res.status(201).json({ gateway });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un gateway con ese número' });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ mensaje: error.message });
      return;
    }
    res.status(500).json({ mensaje: 'Error al crear el gateway', error });
  }
};

export const actualizarGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ mensaje: 'El ID del gateway no es válido' });
      return;
    }
    const gateway = await Gateway.findOne({ _id: req.params.id, activo: true });
    if (!gateway) {
      res.status(404).json({ mensaje: 'Gateway no encontrado o inactivo' });
      return;
    }

    const numeroGateway = req.body.numeroGateway === undefined ? gateway.numeroGateway : Number(req.body.numeroGateway);
    const tipoCargaPermitida = req.body.tipoCargaPermitida ?? gateway.tipoCargaPermitida;
    const estado = req.body.estado ?? gateway.estado;
    const errorConfiguracion = validarConfiguracion(numeroGateway, tipoCargaPermitida);
    if (errorConfiguracion) {
      res.status(400).json({ mensaje: errorConfiguracion });
      return;
    }
    if (!['LIBRE', 'OCUPADO', 'FUERA DE SERVICIO'].includes(estado)) {
      res.status(400).json({ mensaje: 'El estado del gateway no es válido' });
      return;
    }
    if (estado === 'OCUPADO' && gateway.estado !== 'OCUPADO') {
      res.status(400).json({ mensaje: 'El estado OCUPADO solo se asigna al iniciar una descarga' });
      return;
    }
    if (gateway.estado === 'OCUPADO' && estado !== 'OCUPADO') {
      res.status(400).json({ mensaje: 'Finalice la descarga antes de cambiar el estado del gateway ocupado' });
      return;
    }
    if (gateway.estado === 'OCUPADO' && tipoCargaPermitida !== gateway.tipoCargaPermitida) {
      res.status(400).json({ mensaje: 'No se puede cambiar el tipo de carga mientras el gateway está ocupado' });
      return;
    }

    gateway.numeroGateway = numeroGateway;
    gateway.tipoCargaPermitida = tipoCargaPermitida;
    gateway.estado = estado;
    gateway.usuarioActualizacion = req.usuarioAutenticado!.nombreCompleto;
    await gateway.save();
    await registrarAuditoria({
      entidad: 'Gateway',
      accion: 'actualizar',
      detalle: `Se actualizó el Gateway ${gateway.numeroGateway}`,
      usuario: req.usuarioAutenticado!.nombreCompleto,
    });
    res.status(200).json({ gateway });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un gateway con ese número' });
      return;
    }
    res.status(400).json({ mensaje: 'No se pudo actualizar el gateway', error });
  }
};

export const eliminarGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ mensaje: 'El ID del gateway no es válido' });
      return;
    }
    const gateway = await Gateway.findOne({ _id: req.params.id, activo: true });
    if (!gateway) {
      res.status(404).json({ mensaje: 'Gateway no encontrado o inactivo' });
      return;
    }
    if (gateway.estado === 'OCUPADO') {
      res.status(400).json({ mensaje: 'Finalice la descarga antes de inactivar el gateway ocupado' });
      return;
    }
    gateway.activo = false;
    gateway.usuarioActualizacion = req.usuarioAutenticado!.nombreCompleto;
    await gateway.save();
    await registrarAuditoria({ entidad: 'Gateway', accion: 'inactivar', detalle: `Se inactivó el Gateway ${gateway.numeroGateway}`, usuario: req.usuarioAutenticado!.nombreCompleto });
    res.status(200).json({ mensaje: 'Gateway inactivado correctamente', gateway });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al inactivar el gateway', error });
  }
};