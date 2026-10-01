import { Schema, model, Document } from 'mongoose';

export interface IParametro extends Document {
  clave: string;
  valor: string;
  descripcion: string;
  activo: boolean;
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

const parametroSchema = new Schema<IParametro>(
  {
    clave: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    valor: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    activo: {
      type: Boolean,
      default: true,
      required: true,
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
    timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' } 
  }
);

export const Parametro = model<IParametro>('Parametro', parametroSchema);