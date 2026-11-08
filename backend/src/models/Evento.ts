import { Schema, model, type ClientSession, type Document, type Types } from 'mongoose';

export const ACCIONES_EVENTO = [
  'LLEGADA_REGISTRADA',
  'GATEWAY_ASIGNADO',
  'DESCARGADA_INICIADA',
  'DESCARGA_FINALIZADA',
  'CITA_REPROGRAMADA',
  'GATEWAY_MANTENIMIENTO',
  'INGRESO_COLA',
  'AGING_APLICADO',
  'PROMOCION_AUTOMATICA_GATEWAY',
  'ROL_CREADO',
  'ROL_MODIFICADO',
  'ROL_DESACTIVADO',
  'ROL_ASIGNADO_USUARIO',
] as const;

export type AccionEvento = (typeof ACCIONES_EVENTO)[number];

export interface IEvento extends Document {
  usuarioId: Types.ObjectId;
  pedidoId?: Types.ObjectId;
  accion: AccionEvento;
  detalles: Record<string, unknown>;
  fechaHora: Date;
  activo: boolean;
  usuarioCreacion: string;
  fechaCreacion?: Date;
}

const eventoSchema = new Schema<IEvento>(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, immutable: true },
    pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', immutable: true },
    accion: { type: String, enum: ACCIONES_EVENTO, required: true, immutable: true },
    detalles: { type: Schema.Types.Mixed, required: true, immutable: true },
    fechaHora: { type: Date, required: true, default: Date.now, immutable: true },
    activo: { type: Boolean, required: true, default: true, immutable: true },
    usuarioCreacion: { type: String, required: true, immutable: true },
  },
  {
    collection: 'eventos',
    timestamps: { createdAt: 'fechaCreacion', updatedAt: false },
  }
);

eventoSchema.pre('save', function () {
  if (!this.isNew) throw new Error('Los eventos históricos son inmutables');
});

eventoSchema.index({ fechaHora: -1 });
eventoSchema.index({ pedidoId: 1, fechaHora: -1 });

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  eventoSchema.pre(operation, function () {
    throw new Error('Los eventos históricos son inmutables');
  });
}

export const Evento = model<IEvento>('Evento', eventoSchema, 'eventos');

export interface RegistrarEventoInput {
  usuarioId: string;
  usuario: string;
  accion: AccionEvento;
  detalles: Record<string, unknown>;
  pedidoId?: string;
  session?: ClientSession;
}
