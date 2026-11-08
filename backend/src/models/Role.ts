import { Schema, model, Document, Types } from 'mongoose';

/** Lista cerrada de módulos del sistema que un rol puede tener habilitados. */
export const MODULOS_PERMISO = ['usuarios', 'roles', 'proveedores', 'pedidos', 'gateways', 'descargas', 'cola', 'kpis'] as const;
export type ModuloPermiso = (typeof MODULOS_PERMISO)[number];

/** Roles base del sistema: se crean al iniciar y no pueden renombrarse ni desactivarse. */
export type RoleName = 'administrador' | 'coordinador' | 'operador';

export const ROLES_BASE: Record<RoleName, { descripcion: string; permisos: ModuloPermiso[] }> = {
  administrador: { descripcion: 'Acceso total al sistema', permisos: [...MODULOS_PERMISO] },
  coordinador: { descripcion: 'Gestión operativa y supervisión', permisos: ['proveedores', 'pedidos', 'descargas', 'cola', 'kpis'] },
  operador: { descripcion: 'Operación de caseta, cola y descargas', permisos: ['descargas', 'cola'] },
};

export function esRolBase(nombreRol: string): nombreRol is RoleName {
  return Object.hasOwn(ROLES_BASE, nombreRol);
}

export interface IRole extends Document {
  _id: Types.ObjectId;
  nombreRol: string;
  descripcion: string;
  permisos: ModuloPermiso[];
  activo: boolean;
  usuarioCreacion: string;
  usuarioActualizacion: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

const roleSchema = new Schema<IRole>(
  {
    nombreRol: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    permisos: { type: [{ type: String, enum: MODULOS_PERMISO }], required: true, default: [] },
    activo: { type: Boolean, required: true, default: true },
    usuarioCreacion: { type: String, required: true, default: 'Sistema' },
    usuarioActualizacion: { type: String, required: true, default: 'Sistema' },
  },
  { timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' } }
);

// Único sin distinguir mayúsculas: "Auditor" y "auditor" serían el mismo rol.
roleSchema.index({ nombreRol: 1 }, { unique: true, collation: { locale: 'es', strength: 2 } });

export const Role = model<IRole>('Role', roleSchema);
