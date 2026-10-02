export type Categoria = 'construcción' | 'general';
export type EstadoGateway = 'LIBRE' | 'OCUPADO' | 'FUERA DE SERVICIO';

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
  proveedorId: ProveedorRef | string | null;
  tipoProducto: Categoria;
  fechaHoraProgramada: string;
  inicioVentana: string;
  finVentana: string;
  duracionEstimadaMinutos: number;
  estado: 'PROGRAMADO' | 'ANTICIPADO' | 'A TIEMPO' | 'TARDÍO' | 'AUSENTE' | 'EN COLA' | 'DESCARGANDO' | 'FINALIZADO' | 'CANCELADO';
  fechaHoraLlegadaReal?: string;
}

export interface Gateway {
  _id: string;
  numeroGateway: number;
  tipoCargaPermitida: Categoria;
  estado: EstadoGateway;
  activo: boolean;
}

export interface Descarga {
  _id: string;
  gatewayId: string;
  pedidoId: Pedido | string;
  operadorId: string;
  fechaHoraInicio: string;
  fechaHoraFin?: string;
  duracionMinutos?: number;
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