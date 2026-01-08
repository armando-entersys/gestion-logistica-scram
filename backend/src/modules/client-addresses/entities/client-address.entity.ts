import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from '@/modules/clients/entities/client.entity';

@Entity('client_addresses')
@Index('idx_client_addresses_client', ['clientNumber'])
@Index('idx_client_addresses_client_id', ['clientId'])
export class ClientAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_number', type: 'varchar', length: 50 })
  clientNumber: string;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, (client) => client.addresses, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 10, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'text', nullable: true })
  reference: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ type: 'varchar', length: 20, default: 'MANUAL' })
  source: 'SYNC' | 'MANUAL';

  @Column({ name: 'bind_source_id', type: 'varchar', length: 50, nullable: true })
  bindSourceId: string | null;

  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
