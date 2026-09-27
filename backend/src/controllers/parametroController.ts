import { Request, Response } from 'express';
import { Parametro } from '../models/Parametro.js';
import { registrarAuditoria } from './auditoriaController.js';

export const obtenerParametros = async (_req: Request, res: Response): Promise<void> => {
  try {
    const parametros = await Parametro.find({ activo: true }).sort({ clave: 1 });
    res.status(200).json({ parametros });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar los parámetros del sistema', error });
  }
};

export const crearParametro = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clave, valor, descripcion, activo = true, usuarioCreacion } = req.body;

    if (!clave || !valor || !descripcion) {
      res.status(400).json({ mensaje: 'Los campos clave, valor y descripción son obligatorios' });
      return;
    }

    const yaExiste = await Parametro.findOne({ clave: String(clave).trim() });
    if (yaExiste) {
      res.status(409).json({ mensaje: `Ya existe el parámetro ${clave}` });
      return;
    }

    const nombreUsuario = usuarioCreacion || 'Sistema';
    const parametro = await Parametro.create({
      clave: String(clave).trim(),
      valor: String(valor),
      descripcion: String(descripcion).trim(),
      activo: Boolean(activo),
      usuarioCreacion: nombreUsuario,
      usuarioActualizacion: nombreUsuario,
    });

    await registrarAuditoria({
      entidad: 'Parametro',
      accion: 'crear',
      detalle: `Se creó el parámetro ${parametro.clave} con valor ${parametro.valor}`,
      usuario: 'Sistema',
    });

    res.status(201).json({ mensaje: 'Parámetro registrado correctamente', parametro });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar el parámetro', error });
  }
};

export const actualizarParametro = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { valor, descripcion, activo, usuarioActualizacion } = req.body;

    const parametro = await Parametro.findById(id);
    if (!parametro) {
      res.status(404).json({ mensaje: 'Parámetro no encontrado' });
      return;
    }

    if (valor !== undefined) parametro.valor = String(valor);
    if (descripcion !== undefined) parametro.descripcion = String(descripcion).trim();
    if (activo !== undefined) parametro.activo = Boolean(activo);

    parametro.usuarioActualizacion = usuarioActualizacion || 'Sistema';
    await parametro.save();

    await registrarAuditoria({
      entidad: 'Parametro',
      accion: 'actualizar',
      detalle: `Se actualizó el parámetro ${parametro.clave}`,
      usuario: 'Sistema',
    });

    res.status(200).json({ mensaje: 'Parámetro actualizado correctamente', parametro });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el parámetro', error });
  }
};

export const inactivarParametro = async (req: Request, res: Response): Promise<void> => {
  try {
    const parametro = await Parametro.findOneAndUpdate(
      { _id: req.params.id, activo: true },
      { $set: { activo: false, usuarioActualizacion: req.body?.usuarioActualizacion || 'Sistema' } },
      { new: true }
    );

    if (!parametro) {
      res.status(404).json({ mensaje: 'Parámetro no encontrado o ya inactivo' });
      return;
    }

    await registrarAuditoria({
      entidad: 'Parametro',
      accion: 'inactivar',
      detalle: `Se inactivó lógicamente el parámetro ${parametro.clave}`,
      usuario: 'Sistema',
    });

    res.status(200).json({ mensaje: 'Parámetro inactivado correctamente', parametro });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al inactivar el parámetro', error });
  }
};