export type Categoria = 'construcción' | 'general';

export interface Proveedor {
  _id: string;
  razonSocial: string;
  identificacionTributaria: string;
  categoria: Categoria;
  contactoNombre: string;
  telefono: string;
  emailContacto: string;
  estado: 'activo' | 'inactivo';
}

export interface ProveedorRef {
  _id: string;
  razonSocial: string;
  identificacionTributaria: string;
  categoria: Categoria;
}

export interface Pedido {
  _id: string;
  numeroPedido: string;
  proveedorId: ProveedorRef | string;
  tipoProducto: Categoria;
  fechaHoraProgramada: string;
  inicioVentana: string;
  finVentana: string;
  duracionEstimadaMinutos: number;
  estado: 'PROGRAMADO' | 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO' | 'AUSENTE' | 'EN_COLA' | 'GATEWAY_ASIGNADO' | 'DESCARGANDO' | 'FINALIZADO' | 'CANCELADO';
  clasificacionPuntualidad?: 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO';
  fechaHoraLlegadaReal?: string;
  gatewayId?: string | GatewayRef;
  fechaEntradaCola?: string;
}

export interface GatewayRef {
  _id: string;
  numeroGateway: number;
  tipoCargaPermitida: Categoria;
  estado: 'LIBRE' | 'OCUPADO' | 'FUERA DE SERVICIO';
}

export interface Gateway extends GatewayRef {
  activo: boolean;
  pedidoAsignadoId?: string;
  pedidoAsignado?: { _id: string; numeroPedido: string; tipoProducto: Categoria; estado: Pedido['estado'] } | null;
}

export interface DescargaActiva {
  _id: string;
  gatewayId: GatewayRef;
  pedidoId: Pedido;
  fechaHoraInicio: string;
}

export interface VentanaAlternativa {
  inicioVentana: string;
  finVentana: string;
}

export interface ConflictoPedido {
  mensaje: string;
  conflictoCon: {
    numeroPedido: string;
    inicioVentana: string;
    finVentana: string;
  };
  ventanasAlternativas: VentanaAlternativa[];
}

export interface Notificacion {
  _id: string;
  titulo: string;
  mensaje: string;
  entidad: string;
  leida: boolean;
  fechaCreacion: string;
}