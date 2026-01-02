import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EvidenceType } from '@/common/enums';
import { Order } from './order.entity';

@Entity('shipment_evidence')
export class ShipmentEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: 'PHOTO o SIGNATURE',
  })
  type: EvidenceType;

  @Column({
    name: 'storage_key',
    type: 'varchar',
    length: 255,
    comment: 'Ruta relativa en Storage (S3/MinIO)',
  })
  storageKey: string;

  @Column({
    name: 'is_offline_upload',
    default: false,
    comment: 'Flag de sincronizacion tardia desde PWA',
  })
  isOfflineUpload: boolean;

  @Column({ name: 'captured_at', type: 'timestamp', nullable: true })
  capturedAt: Date | null;

  @Column({ name: 'captured_latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  capturedLatitude: number | null;

  @Column({ name: 'captured_longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  capturedLongitude: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.evidences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
