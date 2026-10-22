import { Schema, model, Document } from 'mongoose';

export type CategoriaProveedor = 'construcción' | 'general';

export interface IProveedor extends Document {
  razonSocial: string;
  identificacionTributaria: string;
  categoria: CategoriaProveedor;
  contactoNombre: string;
  telefono: string;
  emailContacto: string;
  estado: 'activo' | 'inactivo';
  activo: boolean;
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

const proveedorSchema = new Schema<IProveedor>(
  {
    razonSocial: {
      type: String,
      required: true,
      trim: true,
      match: [/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/, 'La razón social solo puede contener letras'],
    },
    identificacionTributaria: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^[0-9]+$/, 'La identificación tributaria solo puede contener números'],
    },
    categoria: {
      type: String,
      required: true,
      enum: ['construcción', 'general'],
    },
    contactoNombre: {
      type: String,
      required: true,
      trim: true,
      match: [/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/, 'El nombre de contacto solo puede contener letras'],
    },
    telefono: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4}-\d{4}$/, 'El teléfono debe tener el formato ####-####'],
    },
    emailContacto: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Formato de correo inválido'],
    },
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

proveedorSchema.pre('save', function () {
  this.activo = this.estado === 'activo';
});

export const Proveedor = model<IProveedor>('Proveedor', proveedorSchema);