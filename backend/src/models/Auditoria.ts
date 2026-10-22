import { Schema, model, type Document } from 'mongoose';

export interface IAuditoria extends Document {
  entidad: string;
  accion: string;
  detalle: string;
  usuario: string;
  fecha: Date;
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
      default: 'Sistema',
      trim: true,
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
