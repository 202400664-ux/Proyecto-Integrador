import { Schema, model, type Document } from 'mongoose';
import type { RoleName } from './Role.js';

export interface INotificacion extends Document {
  destinatarioRol: RoleName;
  titulo: string;
  mensaje: string;
  entidad: string;
  entidadId?: string;
  leida: boolean;
  activo: boolean;
  fechaCreacion?: Date;
}

const notificacionSchema = new Schema<INotificacion>(
  {
    destinatarioRol: { type: String, required: true, enum: ['administrador', 'coordinador', 'operador'] },
    titulo: { type: String, required: true, trim: true },
    mensaje: { type: String, required: true, trim: true },
    entidad: { type: String, required: true },
    entidadId: { type: String },
    leida: { type: Boolean, required: true, default: false },
    activo: { type: Boolean, required: true, default: true },
  },
  { timestamps: { createdAt: 'fechaCreacion', updatedAt: false } }
);

notificacionSchema.index({ destinatarioRol: 1, activo: 1, fechaCreacion: -1 });

export const Notificacion = model<INotificacion>('Notificacion', notificacionSchema);