import { Schema, model, type Document, type Types } from 'mongoose';

export interface IDescarga extends Document {
  gatewayId: Types.ObjectId;
  pedidoId: Types.ObjectId;
  operadorId: Types.ObjectId;
  fechaHoraInicio: Date;
  fechaHoraFin?: Date;
  duracionMinutos?: number;
  activo: boolean;
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

const descargaSchema = new Schema<IDescarga>(
  {
    gatewayId: { type: Schema.Types.ObjectId, ref: 'Gateway', required: true },
    pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
    operadorId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    fechaHoraInicio: { type: Date, required: true },
    fechaHoraFin: { type: Date },
    duracionMinutos: { type: Number, min: 0 },
    activo: { type: Boolean, required: true, default: true },
    usuarioCreacion: { type: String, required: true },
    usuarioActualizacion: { type: String, required: true },
  },
  { timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' } }
);

descargaSchema.index({ gatewayId: 1, fechaHoraFin: 1 });
descargaSchema.index({ pedidoId: 1, fechaHoraFin: 1 });

export const Descarga = model<IDescarga>('Descarga', descargaSchema);