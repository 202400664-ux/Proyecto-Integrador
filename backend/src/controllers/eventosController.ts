import type { Request, Response } from 'express';
import { Evento } from '../models/Evento.js';
import { Pedido } from '../models/Pedido.js';
import { Usuario } from '../models/Usuario.js';

export async function listarEventos(_req: Request, res: Response): Promise<void> {
  try {
    const eventos = await Evento.find({ activo: true })
      .populate({ path: 'usuarioId', model: Usuario, select: 'nombres apellidosCompleto email' })
      .populate({ path: 'pedidoId', model: Pedido, select: 'numeroPedido' })
      .sort({ fechaHora: -1 })
      .limit(200)
      .lean();
    res.status(200).json({ eventos });
  } catch (error) {
    console.error('Error al consultar los eventos de auditoría:', error);
    res.status(500).json({ mensaje: 'No se pudieron consultar los eventos de auditoría' });
  }
}
