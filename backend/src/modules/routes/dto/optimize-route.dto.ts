import { IsArray, IsString, IsBoolean, IsOptional, ArrayMinSize, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StopType } from '@/common/enums';

export class OptimizeRouteDto {
  @ApiProperty({
    description: 'IDs de ordenes a optimizar',
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiPropertyOptional({
    description: 'IDs de route stops a incluir en la optimización',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  routeStopIds?: string[];

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
  @IsUUID('4', { each: true })
  optimizedOrderIds: string[];

  @ApiPropertyOptional({
    description: 'Items mixtos optimizados (orders + stops). Si presente, tiene prioridad sobre optimizedOrderIds.',
  })
  @IsOptional()
  @IsArray()
  optimizedItems?: Array<{ type: 'order' | 'stop'; id: string }>;

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
  routeStopId?: string;
  itemType: 'order' | 'stop';
  stopType?: StopType;
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
