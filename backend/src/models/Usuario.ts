import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Interfaz para definir la estructura del documento en TypeScript
export interface IUsuario extends Document {
  nombres: string;
  apellidosCompleto: string;
  email: string;
  password: string;
  roles: Types.ObjectId[];
  estado: 'activo' | 'inactivo';
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Definición del Esquema
const usuarioSchema = new Schema<IUsuario>(
  {
    nombres: {
      type: String,
      required: true,
      trim: true,
    },
    apellidosCompleto: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    roles: [{
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    }],
    estado: {
      type: String,
      enum: ['activo', 'inactivo'],
      default: 'activo',
      required: true,
    },
  },
  { timestamps: true }
);

// 3. Middleware Pre-Save tipado para hash de contraseña
usuarioSchema.pre<IUsuario>('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export const Usuario = model<IUsuario>('Usuario', usuarioSchema);