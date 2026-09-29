import { Schema, model, type Document, type Types } from 'mongoose';

export type TipoMantenimiento = 'preventivo' | 'correctivo' | 'predictivo';
export type EstadoMantenimiento = 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';

export interface IMantenimiento extends Document {
  numeroOrden: string;
  proveedorId: Types.ObjectId;
  titulo: string;
  descripcion: string;
  tipo: TipoMantenimiento;
  estado: EstadoMantenimiento;
  activo: boolean;
  responsable: string;
  fechaProgramada: Date;
  fechaInicio?: Date;
  fechaFin?: Date;
  observaciones?: string;
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

const mantenimientoSchema = new Schema<IMantenimiento>(
  {
    numeroOrden: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    proveedorId: {
      type: Schema.Types.ObjectId,
      ref: 'Proveedor',
      required: true,
    },
    titulo: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      required: true,
      trim: true,
    },
    tipo: {
      type: String,
      required: true,
      enum: ['preventivo', 'correctivo', 'predictivo'],
    },
    estado: {
      type: String,
      required: true,
      enum: ['pendiente', 'en_progreso', 'completado', 'cancelado'],
      default: 'pendiente',
    },
    activo: {
      type: Boolean,
      default: true,
      required: true,
    },
    responsable: {
      type: String,
      required: true,
      trim: true,
    },
    fechaProgramada: {
      type: Date,
      required: true,
    },
    fechaInicio: {
      type: Date,
    },
    fechaFin: {
      type: Date,
    },
    observaciones: {
      type: String,
      trim: true,
    },
    usuarioCreacion: {
      type: String,
      required: true,
      default: 'Sistema',
    },
    usuarioActualizacion: {
      type: String,
      required: true,
      default: 'Sistema',
    },
  },
  {
    timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' },
  }
);

export const Mantenimiento = model<IMantenimiento>('Mantenimiento', mantenimientoSchema);
