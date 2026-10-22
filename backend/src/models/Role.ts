import { Schema, model, Document } from 'mongoose';

export type RoleName = 'administrador' | 'coordinador' | 'operador';

export interface IRole extends Document {
  nombre: RoleName;
  descripcion: string;
}

const roleSchema = new Schema<IRole>({
  nombre: {
    type: String,
    required: true,
    unique: true,
    enum: ['administrador', 'coordinador', 'operador'],
    lowercase: true,
    trim: true,
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
  },
});

export const Role = model<IRole>('Role', roleSchema);
