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
  estado: 'PROGRAMADO' | 'CANCELADO' | 'COMPLETADO';
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