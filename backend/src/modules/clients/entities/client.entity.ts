import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ClientAddress } from '@/modules/client-addresses/entities/client-address.entity';
import { Order } from '@/modules/orders/entities/order.entity';

@Entity('clients')
@Index('idx_clients_number', ['clientNumber'], { unique: true })
@Index('idx_clients_rfc', ['rfc'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_number', type: 'varchar', length: 50, unique: true })
  clientNumber: string;

  @Column({ name: 'bind_id', type: 'varchar', length: 50, nullable: true, comment: 'UUID del cliente en Bind ERP' })
  @Index('idx_clients_bind_id')
  bindId: string | null;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  rfc: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_vip', default: false })
  isVip: boolean;

  @Column({ name: 'total_orders', type: 'int', default: 0 })
  totalOrders: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'last_order_at', type: 'timestamp', nullable: true })
  lastOrderAt: Date | null;

  @Column({ name: 'bind_source', type: 'varchar', length: 20, default: 'SYNC' })
  bindSource: 'SYNC' | 'MANUAL';

  @OneToMany(() => ClientAddress, (address) => address.client)
  addresses: ClientAddress[];

  @OneToMany(() => Order, (order) => order.client)
  orders: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
