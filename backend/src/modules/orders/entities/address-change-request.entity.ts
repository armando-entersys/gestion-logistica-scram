import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum AddressChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('address_change_requests')
export class AddressChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'old_address', type: 'jsonb' })
  oldAddress: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    reference?: string;
  };

  @Column({ name: 'new_address', type: 'jsonb' })
  newAddress: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    reference?: string;
  };

  @Column({
    type: 'enum',
    enum: AddressChangeStatus,
    default: AddressChangeStatus.PENDING,
  })
  status: AddressChangeStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
