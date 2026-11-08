import { Request, Response } from 'express';
import { encolarPedido, listarColaPrioridad, reevaluarCola } from '../services/colaPrioridad.js';

export const obtenerCola = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = req.usuario;
    if (!actor) {
      res.status(401).json({ mensaje: 'Se requiere una sesión autenticada' });
      return;
    }
    res.status(200).json({ pedidos: await listarColaPrioridad({ id: actor.id, nombreCompleto: actor.nombreCompleto }) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar la cola de prioridad', error });
  }
};

export const asignarDesdeCola = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = req.usuario;
    if (!actor) {
      res.status(401).json({ mensaje: 'Se requiere una sesión autenticada' });
      return;
    }
    const pedido = await encolarPedido(String(req.body.pedidoId || ''), {
      id: actor.id,
      nombreCompleto: actor.nombreCompleto,
    });
    res.status(200).json({ mensaje: 'Pedido procesado por la cola de prioridad', pedido });
  } catch (error) {
    res.status(400).json({ mensaje: error instanceof Error ? error.message : 'No se pudo asignar el pedido' });
  }
};

export const reevaluarColaController = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = req.usuario;
    if (!actor) {
      res.status(401).json({ mensaje: 'Se requiere una sesión autenticada' });
      return;
    }
    const operador = { id: actor.id, nombreCompleto: actor.nombreCompleto };
    await reevaluarCola(operador);
    res.status(200).json({ mensaje: 'Cola reevaluada', pedidos: await listarColaPrioridad(operador) });
  } catch (error) {
    res.status(500).json({ mensaje: 'No se pudo reevaluar la cola', error });
  }
};