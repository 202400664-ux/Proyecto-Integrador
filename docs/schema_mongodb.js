/**
 * SumaControl v2.0.1-qa — esquema de base de datos (equivalente al DDL / schema.sql)
 *
 * SumaControl usa MongoDB, por lo que no existe un schema.sql relacional. Este script
 * crea las colecciones con validación $jsonSchema, los índices únicos y los índices
 * compuestos que definen los modelos Mongoose del backend (backend/src/models).
 *
 * La fuente de verdad sigue siendo la definición de los modelos Mongoose; este archivo
 * es una representación para documentación y para levantar una base vacía.
 *
 * Uso:   mongosh "mongodb://localhost:27017/sumacontrol?replicaSet=rs0" schema_mongodb.js
 *
 * Nombres de colección: Mongoose pasa el nombre del modelo a minúsculas y le aplica su
 * regla de plural (agrega "s" a los nombres que terminan en consonante o en "o"/"a"), por
 * eso Proveedor -> proveedors y Notificacion -> notificacions. Solo Evento declara su
 * colección de forma explícita ("eventos"). Los nombres se verificaron contra los modelos
 * de backend/src/models; en una base con datos, `show collections` debe listar los mismos.
 *
 * validationLevel "moderate": los documentos que ya existen no se bloquean si no cumplen
 * la validación; las inserciones nuevas y las actualizaciones de documentos válidos sí.
 */

const COL = {
  Pedido: 'pedidos',
  Gateway: 'gateways',
  Descarga: 'descargas',
  Proveedor: 'proveedors',
  Parametro: 'parametros',
  Usuario: 'usuarios',
  Role: 'roles',
  Evento: 'eventos',
  Auditoria: 'auditorias',
  Notificacion: 'notificacions',
  Mantenimiento: 'mantenimientos',
  ContadorPedido: 'contadorpedidos',
};

const oid = { bsonType: 'objectId' };
const str = { bsonType: 'string' };
const date = { bsonType: 'date' };
const bool = { bsonType: 'bool' };
const enumStr = (values) => ({ bsonType: 'string', enum: values });

// Campos de auditoría de registro compartidos por las colecciones operativas
const auditoria = {
  usuarioCreacion: str,
  usuarioActualizacion: str,
  fechaCreacion: date,
  fechaActualizacion: date,
};

function crear(nombre, required, properties) {
  const existe = db.getCollectionNames().includes(nombre);
  const validator = { $jsonSchema: { bsonType: 'object', required, properties } };
  const opciones = { validator, validationLevel: 'moderate', validationAction: 'error' };
  if (existe) {
    db.runCommand({ collMod: nombre, ...opciones });
    print(`~ validación actualizada: ${nombre}`);
  } else {
    db.createCollection(nombre, opciones);
    print(`+ colección creada: ${nombre}`);
  }
}

// ---------------------------------------------------------------- Proveedor
crear(COL.Proveedor,
  ['razonSocial', 'identificacionTributaria', 'categoria', 'contactoNombre', 'telefono', 'emailContacto',
    'estado', 'activo', 'usuarioCreacion', 'usuarioActualizacion'],
  {
    razonSocial: { bsonType: 'string', pattern: '^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\\s]+$' },
    identificacionTributaria: { bsonType: 'string', pattern: '^[0-9]+$' },
    categoria: enumStr(['construcción', 'general']),
    contactoNombre: { bsonType: 'string', pattern: '^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\\s]+$' },
    telefono: { bsonType: 'string', pattern: '^\\d{4}-\\d{4}$' },
    emailContacto: { bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    estado: enumStr(['activo', 'inactivo']),
    activo: bool,
    ...auditoria,
  });
db[COL.Proveedor].createIndex({ identificacionTributaria: 1 }, { unique: true });

// ------------------------------------------------------------------- Pedido
crear(COL.Pedido,
  ['numeroPedido', 'proveedorId', 'tipoProducto', 'fechaHoraProgramada', 'inicioVentana', 'finVentana',
    'duracionEstimadaMinutos', 'activo', 'usuarioCreacion', 'usuarioActualizacion'],
  {
    numeroPedido: str,
    proveedorId: oid,
    tipoProducto: enumStr(['construcción', 'general']),
    fechaHoraProgramada: date,
    inicioVentana: date,
    finVentana: date,
    duracionEstimadaMinutos: { bsonType: ['int', 'long', 'double'], minimum: 1 },
    fechaHoraLlegadaReal: date,
    estado: enumStr(['PROGRAMADO', 'ANTICIPADO', 'A TIEMPO', 'TARDÍO', 'AUSENTE', 'EN_COLA',
      'GATEWAY_ASIGNADO', 'DESCARGANDO', 'FINALIZADO', 'CANCELADO']),
    clasificacionPuntualidad: enumStr(['ANTICIPADO', 'A TIEMPO', 'TARDÍO']),
    gatewayId: oid,
    fechaEntradaCola: date,
    activo: bool,
    ...auditoria,
  });
db[COL.Pedido].createIndex({ numeroPedido: 1 }, { unique: true });
// Índices PROPUESTOS (mantenimiento evolutivo, sección 3.3 del informe). No existen en el modelo
// Mongoose: la cola (reevaluarCola, listarColaPrioridad) y liberarAnticipados filtran por estas
// combinaciones. Compare con explain('executionStats') antes y después; si no se adoptan,
// elimine estas dos líneas para que la base coincida con los modelos.
db[COL.Pedido].createIndex({ activo: 1, estado: 1, fechaEntradaCola: 1 });
db[COL.Pedido].createIndex({ activo: 1, estado: 1, inicioVentana: 1 });

// ------------------------------------------------------------------ Gateway
crear(COL.Gateway,
  ['numeroGateway', 'tipoCargaPermitida', 'estado', 'activo', 'usuarioCreacion', 'usuarioActualizacion'],
  {
    numeroGateway: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 5 },
    tipoCargaPermitida: enumStr(['general', 'construcción']),
    estado: enumStr(['LIBRE', 'OCUPADO', 'FUERA DE SERVICIO']),
    pedidoAsignadoId: oid,
    activo: bool,
    ...auditoria,
  });
db[COL.Gateway].createIndex({ numeroGateway: 1 }, { unique: true });

// ----------------------------------------------------------------- Descarga
crear(COL.Descarga,
  ['gatewayId', 'pedidoId', 'operadorId', 'fechaHoraInicio', 'activo', 'usuarioCreacion', 'usuarioActualizacion'],
  {
    gatewayId: oid,
    pedidoId: oid,
    operadorId: oid,
    fechaHoraInicio: date,
    fechaHoraFin: date,
    duracionMinutos: { bsonType: ['int', 'long', 'double'], minimum: 0 },
    activo: bool,
    ...auditoria,
  });
db[COL.Descarga].createIndex({ gatewayId: 1, fechaHoraFin: 1 });
db[COL.Descarga].createIndex({ pedidoId: 1, fechaHoraFin: 1 });

// --------------------------------------------------------------- Parametro
crear(COL.Parametro,
  ['clave', 'valor', 'descripcion', 'activo', 'usuarioCreacion', 'usuarioActualizacion'],
  { clave: str, valor: str, descripcion: str, activo: bool, ...auditoria });
db[COL.Parametro].createIndex({ clave: 1 }, { unique: true });

// -------------------------------------------------------------------- Role
crear(COL.Role, ['nombre', 'descripcion'],
  { nombre: enumStr(['administrador', 'coordinador', 'operador']), descripcion: str });
db[COL.Role].createIndex({ nombre: 1 }, { unique: true });

// ----------------------------------------------------------------- Usuario
crear(COL.Usuario, ['nombres', 'apellidosCompleto', 'email', 'password', 'roles', 'estado'],
  {
    nombres: str,
    apellidosCompleto: str,
    email: str,
    password: str, // hash bcrypt generado al guardar
    roles: { bsonType: 'array', items: oid },
    estado: enumStr(['activo', 'inactivo']),
    createdAt: date,
    updatedAt: date,
  });
db[COL.Usuario].createIndex({ email: 1 }, { unique: true });

// ------------------------------------------------------------------ Evento
// Bitácora inmutable: la inmutabilidad la imponen los hooks del modelo Mongoose
// (no existen actualizaciones ni borrados desde la aplicación).
crear(COL.Evento, ['usuarioId', 'accion', 'detalles', 'fechaHora', 'activo', 'usuarioCreacion'],
  {
    usuarioId: oid,
    pedidoId: oid,
    // 'DESCARGADA_INICIADA' se escribe así en el modelo y en descargaController; se conserva igual
    // porque la bitácora es inmutable y los eventos ya registrados usan ese valor.
    accion: enumStr(['LLEGADA_REGISTRADA', 'GATEWAY_ASIGNADO', 'DESCARGADA_INICIADA', 'DESCARGA_FINALIZADA',
      'CITA_REPROGRAMADA', 'GATEWAY_MANTENIMIENTO']),
    detalles: { bsonType: 'object' },
    fechaHora: date,
    activo: bool,
    usuarioCreacion: str,
    fechaCreacion: date,
  });
db[COL.Evento].createIndex({ fechaHora: -1 });
db[COL.Evento].createIndex({ pedidoId: 1, fechaHora: -1 });

// --------------------------------------------------------------- Auditoria
crear(COL.Auditoria, ['entidad', 'accion', 'detalle', 'usuario', 'fecha'],
  { entidad: str, accion: str, detalle: str, usuario: str, fecha: date, createdAt: date, updatedAt: date });

// ------------------------------------------------------------ Notificacion
crear(COL.Notificacion, ['destinatarioRol', 'titulo', 'mensaje', 'entidad', 'leida', 'activo'],
  {
    destinatarioRol: enumStr(['administrador', 'coordinador', 'operador']),
    titulo: str,
    mensaje: str,
    entidad: str,
    entidadId: str,
    leida: bool,
    activo: bool,
    fechaCreacion: date,
  });
db[COL.Notificacion].createIndex({ destinatarioRol: 1, activo: 1, fechaCreacion: -1 });

// ----------------------------------------------------------- Mantenimiento
crear(COL.Mantenimiento,
  ['numeroOrden', 'proveedorId', 'titulo', 'descripcion', 'tipo', 'estado', 'activo', 'responsable',
    'fechaProgramada', 'usuarioCreacion', 'usuarioActualizacion'],
  {
    numeroOrden: str,
    proveedorId: oid,
    titulo: str,
    descripcion: str,
    tipo: enumStr(['preventivo', 'correctivo', 'predictivo']),
    estado: enumStr(['pendiente', 'en_progreso', 'completado', 'cancelado']),
    activo: bool,
    responsable: str,
    fechaProgramada: date,
    fechaInicio: date,
    fechaFin: date,
    observaciones: str,
    ...auditoria,
  });
db[COL.Mantenimiento].createIndex({ numeroOrden: 1 }, { unique: true });

// ---------------------------------------------------------- ContadorPedido
// Contador atómico del correlativo PED-EQUI##-######### (RN-01), un documento por equipo.
crear(COL.ContadorPedido, ['equipo', 'ultimo'],
  { equipo: { bsonType: ['int', 'long', 'double'] }, ultimo: { bsonType: ['int', 'long', 'double'], minimum: 0 }, createdAt: date, updatedAt: date });
db[COL.ContadorPedido].createIndex({ equipo: 1 }, { unique: true });

print('Esquema de SumaControl aplicado: 12 colecciones.');