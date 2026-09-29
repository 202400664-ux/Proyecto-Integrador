import { Schema, model, type Document } from 'mongoose';

export interface IAuditoria extends Document {
  entidad: string;
  accion: string;
  detalle: string;
  usuario: string;
  fecha: Date;
  activo: boolean;
}

const auditoriaSchema = new Schema<IAuditoria>(
  {
    entidad: {
      type: String,
      required: true,
      trim: true,
    },
    accion: {
      type: String,
      required: true,
      trim: true,
    },
    detalle: {
      type: String,
      required: true,
      trim: true,
    },
    usuario: {
      type: String,
      required: true,
      trim: true,
    },
    activo: {
      type: Boolean,
      default: true,
      required: true,
    },
    fecha: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

export const Auditoria = model<IAuditoria>('Auditoria', auditoriaSchema);
