import { Request, Response } from 'express';
import { Proveedor, type CategoriaProveedor } from '../models/Proveedor.js';
import { registrarAuditoria } from './auditoriaController.js';

const CATEGORIAS_VALIDAS: CategoriaProveedor[] = ['construcción', 'general'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// El frontend ya sanea estos campos mientras se escribe; se valida también
// aquí porque el backend nunca debe confiar únicamente en el frontend
// (por ejemplo, una petición directa por Postman debe seguir respetando el formato).
const SOLO_LETRAS_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
const SOLO_NUMEROS_REGEX = /^[0-9]+$/;
const TELEFONO_REGEX = /^\d{4}-\d{4}$/;

export const crearProveedor = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      razonSocial,
      identificacionTributaria,
      categoria,
      contactoNombre,
      telefono,
      emailContacto,
      usuarioCreacion,
    } = req.body;

    // 1. Campos obligatorios
    if (
      !razonSocial ||
      !identificacionTributaria ||
      !categoria ||
      !contactoNombre ||
      !telefono ||
      !emailContacto
    ) {
      res.status(400).json({ mensaje: 'Todos los campos del proveedor son obligatorios' });
      return;
    }

    // 2. Formato de razón social y nombre de contacto: solo letras y espacios
    if (!SOLO_LETRAS_REGEX.test(razonSocial)) {
      res.status(400).json({ mensaje: 'La razón social solo puede contener letras' });
      return;
    }
    if (!SOLO_LETRAS_REGEX.test(contactoNombre)) {
      res.status(400).json({ mensaje: 'El nombre de contacto solo puede contener letras' });
      return;
    }

    // 3. Identificación tributaria: solo números, sin guiones ni caracteres especiales
    if (!SOLO_NUMEROS_REGEX.test(identificacionTributaria)) {
      res.status(400).json({
        mensaje: 'La identificación tributaria solo puede contener números, sin caracteres especiales',
      });
      return;
    }

    // 4. Teléfono: formato ####-#### (8 dígitos)
    if (!TELEFONO_REGEX.test(telefono)) {
      res.status(400).json({ mensaje: 'El teléfono debe tener el formato ####-#### (8 dígitos)' });
      return;
    }

    // 5. Categoría restringida (lista cerrada)
    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      res.status(400).json({
        mensaje: `La categoría debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}`,
      });
      return;
    }

    // 6. Formato de correo válido
    if (!EMAIL_REGEX.test(emailContacto)) {
      res.status(400).json({ mensaje: 'El correo de contacto no tiene un formato válido' });
      return;
    }

    // 7. identificacionTributaria única (chequeo previo, además del índice unique del esquema)
    const yaExiste = await Proveedor.findOne({ identificacionTributaria });
    if (yaExiste) {
      res.status(409).json({
        mensaje: 'Ya existe un proveedor registrado con esa identificación tributaria',
      });
      return;
    }

    const proveedor = await Proveedor.create({
      razonSocial,
      identificacionTributaria,
      categoria,
      contactoNombre,
      telefono,
      emailContacto,
      estado: 'activo',
      activo: true,
      usuarioCreacion: usuarioCreacion || 'Sistema',
      usuarioActualizacion: usuarioCreacion || 'Sistema',
    });

    await registrarAuditoria({
      entidad: 'Proveedor',
      accion: 'crear',
      detalle: `Se registró el proveedor ${proveedor.razonSocial} (${proveedor.identificacionTributaria})`,
      usuario: 'Sistema',
    });

    res.status(201).json({ mensaje: 'Proveedor registrado correctamente', proveedor });
  } catch (error: unknown) {
    // Respaldo por si dos peticiones llegan al mismo tiempo (condición de carrera del índice único)
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
      res.status(409).json({
        mensaje: 'Ya existe un proveedor registrado con esa identificación tributaria',
      });
      return;
    }
    res.status(500).json({ mensaje: 'Error interno al registrar el proveedor', error });
  }
};

export const obtenerProveedores = async (_req: Request, res: Response): Promise<void> => {
  try {
    const proveedores = await Proveedor.find({ activo: true, estado: 'activo' }).sort({ razonSocial: 1 });
    res.status(200).json({ proveedores });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno al listar proveedores', error });
  }
};

export const actualizarProveedor = async (req: Request, res: Response): Promise<void> => {
  try {
    const proveedor = await Proveedor.findOne({ _id: req.params.id, activo: true });
    if (!proveedor) {
      res.status(404).json({ mensaje: 'Proveedor no encontrado o inactivo' });
      return;
    }

    const campos = ['razonSocial', 'identificacionTributaria', 'categoria', 'contactoNombre', 'telefono', 'emailContacto'] as const;
    for (const campo of campos) {
      if (req.body[campo] !== undefined) (proveedor as any)[campo] = req.body[campo];
    }
    proveedor.usuarioActualizacion = req.body.usuarioActualizacion || 'Sistema';
    await proveedor.save();

    await registrarAuditoria({
      entidad: 'Proveedor',
      accion: 'actualizar',
      detalle: `Se actualizó el proveedor ${proveedor.razonSocial}`,
      usuario: proveedor.usuarioActualizacion,
    });
    res.status(200).json({ mensaje: 'Proveedor actualizado correctamente', proveedor });
  } catch (error: unknown) {
    res.status(400).json({ mensaje: 'No se pudo actualizar el proveedor', error });
  }
};

export const inactivarProveedor = async (req: Request, res: Response): Promise<void> => {
  try {
    const proveedor = await Proveedor.findOneAndUpdate(
      { _id: req.params.id, activo: true },
      { $set: { activo: false, estado: 'inactivo', usuarioActualizacion: req.body.usuarioActualizacion || 'Sistema' } },
      { new: true }
    );
    if (!proveedor) {
      res.status(404).json({ mensaje: 'Proveedor no encontrado o ya inactivo' });
      return;
    }
    await registrarAuditoria({
      entidad: 'Proveedor',
      accion: 'inactivar',
      detalle: `Se inactivó lógicamente el proveedor ${proveedor.razonSocial}`,
      usuario: proveedor.usuarioActualizacion,
    });
    res.status(200).json({ mensaje: 'Proveedor inactivado correctamente', proveedor });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al inactivar el proveedor', error });
  }
};