import { Request, Response } from 'express';
import { Gateway, type TipoCargaGateway } from '../models/Gateway.js';
import { Pedido } from '../models/Pedido.js';
import { registrarAuditoria } from './auditoriaController.js';
import { reevaluarCola } from '../services/colaPrioridad.js';
import { notificarRol } from '../services/notificaciones.js';

const tipoPermitido = (numeroGateway: number): TipoCargaGateway =>
  numeroGateway === 5 ? 'construcción' : 'general';

export async function inicializarGateways(): Promise<void> {
  await Gateway.bulkWrite(
    Array.from({ length: 5 }, (_, index) => {
      const numeroGateway = index + 1;
      return {
        updateOne: {
          filter: { numeroGateway },
          update: {
            $setOnInsert: {
              numeroGateway,
              tipoCargaPermitida: tipoPermitido(numeroGateway),
              estado: 'LIBRE',
              activo: true,
              usuarioCreacion: 'Sistema',
              usuarioActualizacion: 'Sistema',
            },
          },
          upsert: true,
        },
      };
    })
  );
}

export const listarGateways = async (_req: Request, res: Response): Promise<void> => {
  try {
    await inicializarGateways();
    const gateways = await Gateway.find({ activo: true }).sort({ numeroGateway: 1 }).lean();
    const pedidosAsignados = await Pedido.find({
      activo: true,
      estado: { $in: ['GATEWAY_ASIGNADO', 'DESCARGANDO'] },
    }).select('numeroPedido tipoProducto estado gatewayId').lean();
    const porGateway = new Map(pedidosAsignados.map((pedido) => [String(pedido.gatewayId), pedido]));

    res.status(200).json({
      gateways: gateways.map((gateway) => ({
        ...gateway,
        pedidoAsignado: porGateway.get(String(gateway._id)) ?? null,
      })),
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar gateways', error });
  }
};

export const crearGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    const numeroGateway = Number(req.body.numeroGateway);
    if (!Number.isInteger(numeroGateway) || numeroGateway < 1 || numeroGateway > 5) {
      res.status(400).json({ mensaje: 'numeroGateway debe ser un entero entre 1 y 5' });
      return;
    }
    const esperado = tipoPermitido(numeroGateway);
    if (req.body.tipoCargaPermitida && req.body.tipoCargaPermitida !== esperado) {
      res.status(400).json({ mensaje: `El Gateway ${numeroGateway} solo permite carga ${esperado}` });
      return;
    }
    const gateway = await Gateway.create({
      numeroGateway,
      tipoCargaPermitida: esperado,
      estado: 'LIBRE',
      activo: true,
      usuarioCreacion: req.usuario?.nombreCompleto || 'Sistema',
      usuarioActualizacion: req.usuario?.nombreCompleto || 'Sistema',
    });
    await registrarAuditoria({ entidad: 'Gateway', accion: 'crear', detalle: `Se creó el Gateway ${numeroGateway}`, usuario: req.usuario?.nombreCompleto });
    res.status(201).json({ mensaje: 'Gateway creado', gateway });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({ mensaje: 'Ya existe un Gateway con ese número' });
      return;
    }
    res.status(500).json({ mensaje: 'Error al crear gateway', error });
  }
};

export const actualizarGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    const gateway = await Gateway.findOne({ _id: req.params.id, activo: true });
    if (!gateway) {
      res.status(404).json({ mensaje: 'Gateway no encontrado o inactivo' });
      return;
    }
    if (req.body.tipoCargaPermitida !== undefined && req.body.tipoCargaPermitida !== tipoPermitido(gateway.numeroGateway)) {
      res.status(400).json({ mensaje: `El Gateway ${gateway.numeroGateway} debe conservar carga ${tipoPermitido(gateway.numeroGateway)}` });
      return;
    }
    if (gateway.estado === 'OCUPADO' && req.body.estado && req.body.estado !== 'OCUPADO') {
      res.status(400).json({ mensaje: 'Finalice la descarga antes de cambiar el estado del gateway' });
      return;
    }
    if (gateway.pedidoAsignadoId && req.body.estado === 'FUERA DE SERVICIO') {
      res.status(400).json({ mensaje: 'Retire la asignación pendiente antes de sacar el gateway de servicio' });
      return;
    }
    if (req.body.estado && !['LIBRE', 'FUERA DE SERVICIO'].includes(req.body.estado)) {
      res.status(400).json({ mensaje: 'El estado solo puede cambiarse a LIBRE o FUERA DE SERVICIO desde administración' });
      return;
    }
    if (req.body.estado) gateway.estado = req.body.estado;
    gateway.usuarioActualizacion = req.usuario?.nombreCompleto || 'Sistema';
    await gateway.save();
    if (gateway.estado === 'LIBRE') await reevaluarCola();
    await registrarAuditoria({ entidad: 'Gateway', accion: 'actualizar', detalle: `Se actualizó el Gateway ${gateway.numeroGateway}: ${gateway.estado}`, usuario: gateway.usuarioActualizacion });
    await notificarRol(
      'coordinador',
      'Configuración de Gateway actualizada',
      `Gateway ${gateway.numeroGateway}: estado ${gateway.estado}`,
      'Gateway',
      String(gateway._id)
    );
    res.status(200).json({ mensaje: 'Gateway actualizado', gateway });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar gateway', error });
  }
};

export const inactivarGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    const gateway = await Gateway.findOne({ _id: req.params.id, activo: true });
    if (!gateway) {
      res.status(404).json({ mensaje: 'Gateway no encontrado o inactivo' });
      return;
    }
    if (gateway.estado === 'OCUPADO') {
      res.status(400).json({ mensaje: 'Finalice la descarga antes de inactivar el gateway' });
      return;
    }
    if (!['LIBRE', 'FUERA DE SERVICIO'].includes(gateway.estado)) {
      res.status(400).json({ mensaje: 'Solo se puede inactivar un gateway LIBRE o FUERA DE SERVICIO' });
      return;
    }
    const usuario = req.usuario?.nombreCompleto || 'Sistema';
    if (gateway.pedidoAsignadoId) {
      const pedidoDevueltoACola = await Pedido.findOneAndUpdate(
        { _id: gateway.pedidoAsignadoId, gatewayId: gateway._id, estado: 'GATEWAY_ASIGNADO', activo: true },
        { $set: { estado: 'EN_COLA', usuarioActualizacion: usuario }, $unset: { gatewayId: 1 } },
        { returnDocument: 'after' }
      );
      if (!pedidoDevueltoACola) {
        res.status(409).json({ mensaje: 'No se pudo liberar la asignación pendiente del gateway' });
        return;
      }
      gateway.pedidoAsignadoId = undefined;
    }
    gateway.activo = false;
    gateway.usuarioActualizacion = usuario;
    await gateway.save();
    await reevaluarCola();
    await registrarAuditoria({ entidad: 'Gateway', accion: 'inactivar', detalle: `Se inactivó el Gateway ${gateway.numeroGateway}`, usuario: gateway.usuarioActualizacion });
    res.status(200).json({ mensaje: 'Gateway inactivado lógicamente', gateway });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al inactivar gateway', error });
  }
};

export const listarGatewaysInactivos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const gateways = await Gateway.find({ activo: false }).sort({ numeroGateway: 1 });
    res.status(200).json({ gateways });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar gateways inactivos', error });
  }
};

export const reactivarGateway = async (req: Request, res: Response): Promise<void> => {
  try {
    const gateway = await Gateway.findOne({ _id: req.params.id, activo: false });
    if (!gateway) {
      res.status(404).json({ mensaje: 'Gateway inactivo no encontrado' });
      return;
    }
    gateway.activo = true;
    gateway.estado = 'LIBRE';
    gateway.pedidoAsignadoId = undefined;
    gateway.usuarioActualizacion = req.usuario?.nombreCompleto || 'Sistema';
    await gateway.save();
    await registrarAuditoria({ entidad: 'Gateway', accion: 'reactivar', detalle: `Se reactivó el Gateway ${gateway.numeroGateway}`, usuario: gateway.usuarioActualizacion });
    await reevaluarCola();
    res.status(200).json({ mensaje: 'Gateway reactivado', gateway });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al reactivar gateway', error });
  }
};