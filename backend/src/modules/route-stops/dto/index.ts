import { IsString, IsOptional, IsNumber, IsEnum, IsUUID, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StopType } from '@/common/enums';

// ── Pickup Points ────────────────────────────────────────

export class CreatePickupPointDto {
  @ApiPropertyOptional({ description: 'UUID del cliente (tabla clients)' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ description: 'Nombre del cliente' })
  @IsString()
  clientName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Etiqueta del punto (ej: "Planta Norte")' })
  @IsOptional()
  @IsString()
  label?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdatePickupPointDto extends PartialType(CreatePickupPointDto) {}

// ── Route Stops ──────────────────────────────────────────

export class AddressRawDto {
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
}

export class CreateRouteStopDto {
  @ApiProperty({ enum: StopType })
  @IsEnum(StopType)
  stopType: StopType;

  @ApiPropertyOptional({ description: 'UUID del punto de recolección guardado (copia dirección automáticamente)' })
  @IsOptional()
  @IsUUID()
  pickupPointId?: string;

  @ApiPropertyOptional({ description: 'UUID del cliente' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ description: 'Nombre del cliente' })
  @IsString()
  clientName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ type: AddressRawDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressRawDto)
  addressRaw?: AddressRawDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Descripción de la parada (motivo de la visita)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Descripción de lo que se recoge/entrega' })
  @IsOptional()
  @IsString()
  itemsDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class CompleteRouteStopDto {
  @ApiPropertyOptional({ description: 'Notas de completación' })
  @IsOptional()
  @IsString()
  completionNotes?: string;

  @ApiPropertyOptional({ description: 'Foto en base64 (requerida para PICKUP)' })
  @IsOptional()
  @IsString()
  base64Photo?: string;
}

export class DispatchStopsDto {
  @ApiProperty({ description: 'IDs de stops a despachar' })
  @IsArray()
  @IsUUID('4', { each: true })
  stopIds: string[];

  @ApiProperty({ description: 'UUID del chofer' })
  @IsUUID()
  driverId: string;
}
