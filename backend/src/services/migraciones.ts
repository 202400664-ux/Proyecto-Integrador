import { Parametro } from '../models/Parametro.js';
import { Pedido } from '../models/Pedido.js';
import { Role, ROLES_BASE } from '../models/Role.js';
import { Usuario } from '../models/Usuario.js';
import { FACTOR_AGING_POR_DEFECTO, LIMITE_ESPERA_POR_DEFECTO } from './colaPrioridad.js';

/**
 * Adapta datos creados por sprints anteriores al esquema actual y garantiza
 * los catálogos base. Es idempotente: se ejecuta en cada arranque.
 * Usa el driver nativo porque mongoose descarta los campos que ya no están en el esquema.
 */
export async function aplicarMigraciones(): Promise<void> {
  await migrarRoles();
  await asegurarRolesBase();
  await Usuario.collection.updateMany(
    { nombreCompleto: { $exists: false } },
    [{ $set: { nombreCompleto: { $trim: { input: { $concat: ['$nombres', ' ', '$apellidosCompleto'] } } } } }]
  );
  await Pedido.collection.updateMany({ fechaEntradaCola: { $exists: true } }, { $rename: { fechaEntradaCola: 'fechaHoraIngresoCola' } });
  await Pedido.collection.updateMany({ estado: 'EN_COLA' }, { $set: { estado: 'EN COLA' } });
  await Pedido.collection.updateMany({ estado: 'GATEWAY_ASIGNADO' }, { $set: { estado: 'GATEWAY ASIGNADO' } });
  await asegurarParametrosCola();
}

async function migrarRoles(): Promise<void> {
  // El índice único anterior impediría renombrar: varios documentos quedarían sin "nombre".
  await Role.collection.dropIndex('nombre_1').catch(() => undefined);
  await Role.collection.updateMany({ nombre: { $exists: true } }, { $rename: { nombre: 'nombreRol' } });
  await Role.createIndexes();
}

async function asegurarRolesBase(): Promise<void> {
  const ahora = new Date();
  for (const [nombreRol, base] of Object.entries(ROLES_BASE)) {
    await Role.collection.updateOne(
      { nombreRol, permisos: { $exists: false } },
      { $set: { permisos: base.permisos, activo: true, usuarioCreacion: 'Sistema', usuarioActualizacion: 'Sistema', fechaCreacion: ahora, fechaActualizacion: ahora } }
    );
    await Role.updateOne(
      { nombreRol },
      { $setOnInsert: { nombreRol, descripcion: base.descripcion, permisos: base.permisos, activo: true, usuarioCreacion: 'Sistema', usuarioActualizacion: 'Sistema' } },
      { upsert: true }
    );
  }
}

async function asegurarParametrosCola(): Promise<void> {
  const parametros = [
    { clave: 'factor_aging_min', valor: String(FACTOR_AGING_POR_DEFECTO), descripcion: 'Minutos en cola que suman 1 punto de prioridad (aging)' },
    { clave: 'limite_espera_max', valor: String(LIMITE_ESPERA_POR_DEFECTO), descripcion: 'Minutos en cola a partir de los cuales el pedido se señala como espera crítica' },
  ];
  for (const parametro of parametros) {
    await Parametro.updateOne(
      { clave: parametro.clave },
      { $setOnInsert: { ...parametro, activo: true, usuarioCreacion: 'Sistema', usuarioActualizacion: 'Sistema' } },
      { upsert: true }
    );
  }
}
