import { Schema, model, type Document } from 'mongoose';

interface IContadorPedido extends Document {
  equipo: number;
  ultimo: number;
}

const contadorPedidoSchema = new Schema<IContadorPedido>(
  {
    equipo: { type: Number, required: true, unique: true },
    ultimo: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const ContadorPedido = model<IContadorPedido>('ContadorPedido', contadorPedidoSchema);