import { Request, Response } from 'express';
import { Parametro } from '../models/Parametro.js';
import { registrarAuditoria } from './auditoriaController.js';
import { validarNombreCompleto } from '../utils/usuario.js';

const CLAVES_TOLERANCIA = new Set([
  'tolerancia_anticipado_minutos',
  'tolerancia_tardio_minutos',
  'tolerancia_ausente_minutos',
]);

async function validarValorParametro(clave: string, valor: string): Promise<string | null> {
  if (CLAVES_TOLERANCIA.has(clave) && !/^\d+$/.test(valor)) {
    return 'Las tolerancias deben ser minutos enteros iguales o mayores a cero';
  }
  if (clave !== 'hora_apertura' && clave !== 'hora_cierre') return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return 'El horario debe tener formato HH:mm';

  const otraClave = clave === 'hora_apertura' ? 'hora_cierre' : 'hora_apertura';
  const otroParametro = await Parametro.findOne({ clave: otraClave, activo: true });
  const apertura = clave === 'hora_apertura' ? valor : otroParametro?.valor || '07:00';
  const cierre = clave === 'hora_cierre' ? valor : otroParametro?.valor || '17:00';
  const minutos = (hora: string) => {
    const [horas, mins] = hora.split(':').map(Number);
    return horas * 60 + mins;
  };
  return minutos(apertura) < minutos(cierre) ? null : 'La apertura debe ser anterior al cierre';
}

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
    const nombreUsuario = validarNombreCompleto(usuarioCreacion);

    if (!clave || valor === undefined || valor === '' || !descripcion || !nombreUsuario) {
      res.status(400).json({ mensaje: 'Clave, valor, descripción y nombre completo son obligatorios' });
      return;
    }

    const claveNormalizada = String(clave).trim();
    const valorNormalizado = String(valor).trim();
    const errorValor = await validarValorParametro(claveNormalizada, valorNormalizado);
    if (errorValor) {
      res.status(400).json({ mensaje: errorValor });
      return;
    }

    const yaExiste = await Parametro.findOne({ clave: claveNormalizada });
    if (yaExiste) {
      res.status(409).json({ mensaje: `Ya existe el parámetro ${clave}` });
      return;
    }

    const parametro = await Parametro.create({
      clave: claveNormalizada,
      valor: valorNormalizado,
      descripcion: String(descripcion).trim(),
      activo: Boolean(activo),
      usuarioCreacion: nombreUsuario,
      usuarioActualizacion: nombreUsuario,
    });

    await registrarAuditoria({
      entidad: 'Parametro',
      accion: 'crear',
      detalle: `Se creó el parámetro ${parametro.clave} con valor ${parametro.valor}`,
      usuario: nombreUsuario,
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
    const nombreUsuario = validarNombreCompleto(usuarioActualizacion);
    if (!nombreUsuario) {
      res.status(400).json({ mensaje: 'usuarioActualizacion debe incluir el nombre completo del usuario' });
      return;
    }

    const parametro = await Parametro.findOne({ _id: id, activo: true });
    if (!parametro) {
      res.status(404).json({ mensaje: 'Parámetro no encontrado' });
      return;
    }

    if (valor !== undefined) parametro.valor = String(valor);
    if (descripcion !== undefined) parametro.descripcion = String(descripcion).trim();
    if (activo !== undefined) parametro.activo = Boolean(activo);
    if (valor !== undefined) {
      const errorValor = await validarValorParametro(parametro.clave, parametro.valor);
      if (errorValor) {
        res.status(400).json({ mensaje: errorValor });
        return;
      }
    }

    parametro.usuarioActualizacion = nombreUsuario;
    await parametro.save();

    await registrarAuditoria({
      entidad: 'Parametro',
      accion: 'actualizar',
      detalle: `Se actualizó el parámetro ${parametro.clave}`,
      usuario: nombreUsuario,
    });

    res.status(200).json({ mensaje: 'Parámetro actualizado correctamente', parametro });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el parámetro', error });
  }
};

export const inactivarParametro = async (req: Request, res: Response): Promise<void> => {
  try {
    const nombreUsuario = validarNombreCompleto(req.body?.usuarioActualizacion);
    if (!nombreUsuario) {
      res.status(400).json({ mensaje: 'usuarioActualizacion debe incluir el nombre completo del usuario' });
      return;
    }
    const parametro = await Parametro.findOneAndUpdate(
      { _id: req.params.id, activo: true },
      { $set: { activo: false, usuarioActualizacion: nombreUsuario } },
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
      usuario: nombreUsuario,
    });

    res.status(200).json({ mensaje: 'Parámetro inactivado correctamente', parametro });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al inactivar el parámetro', error });
  }
};