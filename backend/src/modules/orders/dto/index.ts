import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsArray, IsUUID, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OrderStatus, PriorityLevel, CarrierType, OrderSource } from '@/common/enums';

export class AddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Dirección original de Bind sin parsear' })
  @IsOptional()
  @IsString()
  original?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'ID único del ERP Bind (UUID del pedido o factura)' })
  @IsString()
  bindId: string;

  @ApiPropertyOptional({ description: 'UUID de la factura en Bind (si origen es factura)' })
  @IsOptional()
  @IsString()
  bindInvoiceId?: string;

  @ApiPropertyOptional({ description: 'Número de factura Bind (ej: FA15821)' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Origen de la orden: BIND_ORDER, BIND_INVOICE, MANUAL', enum: OrderSource })
  @IsOptional()
  @IsEnum(OrderSource)
  orderSource?: OrderSource;

  @ApiPropertyOptional({ description: 'Número de pedido visible (ej: PE2945)' })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({ description: 'Almacén de origen' })
  @IsOptional()
  @IsString()
  warehouseName?: string;

  @ApiPropertyOptional({ description: 'Vendedor/Empleado asignado' })
  @IsOptional()
  @IsString()
  employeeName?: string;

  @ApiPropertyOptional({ description: 'Número de cliente en Bind' })
  @IsOptional()
  @IsString()
  clientNumber?: string;

  @ApiPropertyOptional({ description: 'UUID del cliente en Bind ERP (ClientID)' })
  @IsOptional()
  @IsString()
  bindClientId?: string;

  @ApiPropertyOptional({ description: 'Orden de compra del cliente' })
  @IsOptional()
  @IsString()
  purchaseOrder?: string;

  @ApiProperty()
  @IsString()
  clientName: string;

  @ApiProperty()
  @IsString()
  clientEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientRfc?: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  addressRaw: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  promisedDate?: Date;

  @ApiPropertyOptional({ description: 'Lista de artículos/conceptos del pedido' })
  @IsOptional()
  @IsArray()
  items?: Array<{
    productId: string;
    name: string;
    code: string;
    quantity: number;
    price: number;
  }>;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PriorityLevel })
  @IsOptional()
  @IsEnum(PriorityLevel)
  priorityLevel?: PriorityLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class AssignDriverDto {
  @ApiProperty({ description: 'UUID del chofer' })
  @IsUUID()
  driverId: string;

  @ApiProperty({ description: 'Lista de UUIDs de órdenes a asignar', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds: string[];
}

export class DispatchRouteDto {
  @ApiProperty({ description: 'UUID del chofer' })
  @IsUUID()
  driverId: string;

  @ApiProperty({ description: 'Lista de UUIDs de órdenes en secuencia', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiPropertyOptional({ description: 'Hora de inicio de ruta (HH:mm)', default: '09:00' })
  @IsOptional()
  @IsString()
  startTime?: string;
}

export class UpdateLocationDto {
  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;
}

export class SubmitCsatDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class AssignCarrierDto {
  @ApiProperty({ description: 'Lista de UUIDs de órdenes', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiProperty({ enum: CarrierType, description: 'Tipo de carrier/paquetería' })
  @IsEnum(CarrierType)
  carrierType: CarrierType;

  @ApiPropertyOptional({ description: 'Nombre personalizado del carrier (para tipo OTHER)' })
  @IsOptional()
  @IsString()
  carrierName?: string;

  @ApiPropertyOptional({ description: 'Número de guía de la paquetería' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Fecha de entrega por paquetería/proveedor (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @ApiPropertyOptional({ description: 'Hora de entrega por paquetería/proveedor (HH:mm)' })
  @IsOptional()
  @IsString()
  deliveryTime?: string;
}

export class UpdateAddressDto {
  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  addressRaw: AddressDto;

  @ApiPropertyOptional({ description: 'Re-geocode address after update', default: true })
  @IsOptional()
  @IsBoolean()
  geocode?: boolean;
}

export class RequestAddressChangeDto {
  @ApiProperty({ description: 'UUID del pedido' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ type: AddressDto, description: 'Nueva dirección propuesta' })
  @ValidateNested()
  @Type(() => AddressDto)
  newAddress: AddressDto;
}

export class RespondAddressChangeDto {
  @ApiProperty({ description: 'true para aprobar, false para rechazar' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: 'Razón del rechazo (requerido si rechaza)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ReturnOrderDto {
  @ApiProperty({ description: 'UUID del pedido' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Razón de la devolución' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmPickupDto {
  @ApiPropertyOptional({ description: 'Indica si hay un problema con el pedido' })
  @IsOptional()
  @IsBoolean()
  hasIssue?: boolean;

  @ApiPropertyOptional({ description: 'Descripción del problema (requerido si hasIssue es true)' })
  @IsOptional()
  @IsString()
  issueNotes?: string;
}

export class UpdatePromisedDateDto {
  @ApiProperty({ description: 'UUID del pedido' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Nueva fecha de pedido/emisión (YYYY-MM-DD)' })
  @IsString()
  promisedDate: string;
}

export class AdminMarkDeliveredDto {
  @ApiProperty({ description: 'UUIDs de los pedidos a marcar como entregados' })
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiProperty({ description: 'Comentario del admin explicando por qué se marca como entregado' })
  @IsString()
  comment: string;

  @ApiPropertyOptional({ description: 'Enviar email de confirmación al cliente', default: false })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

export class OrderFilterDto {
  @ApiPropertyOptional({ description: 'Status filter (single or comma-separated)', example: 'DRAFT,READY' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: PriorityLevel })
  @IsOptional()
  @IsEnum(PriorityLevel)
  priorityLevel?: PriorityLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
