import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';

@Entity('dismissed_invoices')
@Index('idx_dismissed_invoices_bind_id', ['bindInvoiceId'], { unique: true })
export class DismissedInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bind_invoice_id', type: 'varchar', length: 50, unique: true })
  bindInvoiceId: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({ name: 'client_name', type: 'varchar', length: 200 })
  clientName: string;

  @Column({ name: 'total', type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @Column({ name: 'reason', type: 'text', nullable: true, comment: 'Motivo del descarte' })
  reason: string | null;

  @Column({ name: 'dismissed_by_id', type: 'uuid' })
  dismissedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dismissed_by_id' })
  dismissedBy: User;

  @CreateDateColumn({ name: 'dismissed_at' })
  dismissedAt: Date;
}
