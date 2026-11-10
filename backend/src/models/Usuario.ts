import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Interfaz para definir la estructura del documento en TypeScript
export interface IUsuario extends Document {
  nombres: string;
  apellidosCompleto: string;
  nombreCompleto: string;
  email: string;
  password: string;
  roles: Types.ObjectId[];
  estado: 'activo' | 'inactivo';
  activo: boolean;
  mfaObligatorio: boolean;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  twoFactorRecoveryCodes: string[];
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
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
    nombreCompleto: {
      type: String,
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
      select: false,
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
    activo: {
      type: Boolean,
      default: true,
      required: true,
    },
    mfaObligatorio: {
      type: Boolean,
      default: false,
      required: true,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    twoFactorRecoveryCodes: {
      type: [String],
      default: [],
      select: false,
    },
    usuarioCreacion: {
      type: String,
      default: 'Sistema',
      required: true,
    },
    usuarioActualizacion: {
      type: String,
      default: 'Sistema',
      required: true,
    },
  },
  { timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' } }
);

// 3. Middleware Pre-Save tipado para hash de contraseña
usuarioSchema.pre<IUsuario>('save', async function () {
  this.nombreCompleto = `${this.nombres} ${this.apellidosCompleto}`.trim();
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export const Usuario = model<IUsuario>('Usuario', usuarioSchema);