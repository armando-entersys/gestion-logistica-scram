import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StopType, RouteStopStatus } from '@/common/enums';
import { User } from '@/modules/users/entities/user.entity';
import { PickupPoint } from './pickup-point.entity';

@Entity('route_stops')
@Index('idx_route_stops_driver_status', ['assignedDriverId', 'status'])
@Index('idx_route_stops_pickup_point', ['pickupPointId'])
export class RouteStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stop_type', type: 'varchar', length: 20 })
  stopType: StopType;

  @Column({ type: 'varchar', length: 20, default: RouteStopStatus.PENDING })
  status: RouteStopStatus;

  @Column({ name: 'pickup_point_id', type: 'uuid', nullable: true })
  pickupPointId: string | null;

  @ManyToOne(() => PickupPoint, { nullable: true })
  @JoinColumn({ name: 'pickup_point_id' })
  pickupPoint: PickupPoint | null;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  @Column({ name: 'client_name', type: 'varchar', length: 200 })
  clientName: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 200, nullable: true })
  contactName: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone: string | null;

  @Column({
    name: 'address_raw',
    type: 'jsonb',
    nullable: true,
  })
  addressRaw: {
    street?: string;
    number?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    reference?: string;
  } | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'assigned_driver_id', type: 'uuid', nullable: true })
  assignedDriverId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_driver_id' })
  assignedDriver: User | null;

  @Column({
    name: 'route_position',
    type: 'smallint',
    nullable: true,
  })
  routePosition: number | null;

  @Column({ name: 'estimated_arrival_start', type: 'timestamp', nullable: true })
  estimatedArrivalStart: Date | null;

  @Column({ name: 'estimated_arrival_end', type: 'timestamp', nullable: true })
  estimatedArrivalEnd: Date | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'items_description', type: 'text', nullable: true })
  itemsDescription: string | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy: string | null;

  @Column({ name: 'completion_notes', type: 'text', nullable: true })
  completionNotes: string | null;

  @Column({ name: 'completion_photo_key', type: 'varchar', length: 500, nullable: true })
  completionPhotoKey: string | null;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
