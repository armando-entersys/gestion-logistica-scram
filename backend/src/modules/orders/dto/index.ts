import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsArray, IsUUID, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OrderStatus, PriorityLevel, CarrierType } from '@/common/enums';

export class AddressDto {
  @ApiProperty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsString()
  number: string;

  @ApiProperty()
  @IsString()
  neighborhood: string;

  @ApiProperty()
  @IsString()
  postalCode: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  state: string;

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
  @ApiProperty({ description: 'ID único del ERP Bind (UUID del pedido)' })
  @IsString()
  bindId: string;

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
