import { Schema, model, type Document } from 'mongoose';

export interface IContadorPedido extends Document {
  equipo: string;
  secuencia: number;
}

const contadorPedidoSchema = new Schema<IContadorPedido>(
  {
    equipo: { type: String, required: true, unique: true },
    secuencia: { type: Number, required: true, min: 0, default: 0 },
  },
  { versionKey: false }
);

export const ContadorPedido = model<IContadorPedido>('ContadorPedido', contadorPedidoSchema);