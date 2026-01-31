import { IsArray, IsString, IsBoolean, IsOptional, ArrayMinSize, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OptimizeRouteDto {
  @ApiProperty({
    description: 'IDs de ordenes a optimizar',
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'Se requieren al menos 2 ordenes para optimizar' })
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiPropertyOptional({
    description: 'Hora de inicio de la ruta (HH:mm)',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Respetar prioridades (CRITICAL primero, luego HIGH, luego NORMAL)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  respectPriority?: boolean;
}

export class ApplyOptimizationDto {
  @ApiProperty({
    description: 'IDs de ordenes en el orden optimizado',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  optimizedOrderIds: string[];

  @ApiPropertyOptional({
    description: 'Hora de inicio para calcular ETAs',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  startTime?: string;
}

// Response interfaces
export interface OptimizationLeg {
  orderId: string;
  position: number;
  distanceKm: number;
  durationMinutes: number;
  etaStart: string;
  etaEnd: string;
  clientName: string;
  address: string;
  priority: number;
}

export interface OptimizationResult {
  originalSequence: string[];
  optimizedSequence: string[];
  totalDistanceKm: number;
  originalDistanceKm: number;
  totalDurationMinutes: number;
  savingsPercent: number;
  savingsKm: number;
  legs: OptimizationLeg[];
}
