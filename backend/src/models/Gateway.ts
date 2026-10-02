import { Schema, model, type Document } from 'mongoose';

export type TipoCargaGateway = 'general' | 'construcción';
export type EstadoGateway = 'LIBRE' | 'OCUPADO' | 'FUERA DE SERVICIO';

export interface IGateway extends Document {
  numeroGateway: number;
  tipoCargaPermitida: TipoCargaGateway;
  estado: EstadoGateway;
  activo: boolean;
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

const gatewaySchema = new Schema<IGateway>(
  {
    numeroGateway: { type: Number, required: true, unique: true, min: 1, max: 5 },
    tipoCargaPermitida: { type: String, required: true, enum: ['general', 'construcción'] },
    estado: { type: String, required: true, enum: ['LIBRE', 'OCUPADO', 'FUERA DE SERVICIO'], default: 'LIBRE' },
    activo: { type: Boolean, required: true, default: true },
    usuarioCreacion: { type: String, required: true, default: 'Sistema' },
    usuarioActualizacion: { type: String, required: true, default: 'Sistema' },
  },
  { timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' } }
);

export const Gateway = model<IGateway>('Gateway', gatewaySchema);