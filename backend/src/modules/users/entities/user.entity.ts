import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserRole } from '@/common/enums';
import { Order } from '@/modules/orders/entities/order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index('idx_users_email')
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({
    name: 'role_code',
    type: 'varchar',
    length: 20,
    default: UserRole.SALES,
  })
  roleCode: UserRole;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Order, (order) => order.assignedDriver)
  assignedOrders: Order[];

  // Virtual getters
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
