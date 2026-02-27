export enum OrderStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED_TO_PURCHASING = 'RETURNED_TO_PURCHASING',
  CANCELLED = 'CANCELLED',
}

export enum PriorityLevel {
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum UserRole {
  ADMIN = 'ADMIN',
  PURCHASING = 'PURCHASING',
  DRIVER = 'DRIVER',
  SALES = 'SALES',
  DIRECTOR = 'DIRECTOR',
}

export enum EvidenceType {
  PHOTO = 'PHOTO',
  SIGNATURE = 'SIGNATURE',
}

export enum CarrierType {
  INTERNAL = 'INTERNAL',       // Chofer interno de la empresa
  PROVIDER = 'PROVIDER',       // Entrega directa por proveedor
  FEDEX = 'FEDEX',
  DHL = 'DHL',
  ESTAFETA = 'ESTAFETA',
  PAQUETE_EXPRESS = 'PAQUETE_EXPRESS',
  REDPACK = 'REDPACK',
  UPS = 'UPS',
  OTHER = 'OTHER',             // Otra paquetería (especificar nombre)
}

/**
 * Tipo de origen de la orden
 */
export enum OrderSource {
  BIND_ORDER = 'BIND_ORDER',     // Sincronizado desde pedido de Bind
  BIND_INVOICE = 'BIND_INVOICE', // Creado desde factura de Bind (webhook)
  MANUAL = 'MANUAL',             // Creado manualmente
}

/**
 * Tipo de parada de ruta (no-entrega)
 */
export enum StopType {
  PICKUP = 'PICKUP',               // Recolección de producto en ubicación del cliente
  DOCUMENTATION = 'DOCUMENTATION', // Visita para recoger/entregar documentos
}

/**
 * Estado de una parada de ruta
 */
export enum RouteStopStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
