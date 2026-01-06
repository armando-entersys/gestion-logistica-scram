export enum OrderStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
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
  FEDEX = 'FEDEX',
  DHL = 'DHL',
  ESTAFETA = 'ESTAFETA',
  PAQUETE_EXPRESS = 'PAQUETE_EXPRESS',
  REDPACK = 'REDPACK',
  UPS = 'UPS',
  OTHER = 'OTHER',             // Otra paquetería (especificar nombre)
}
