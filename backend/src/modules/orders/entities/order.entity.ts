import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderStatus, PriorityLevel, CarrierType } from '@/common/enums';
import { User } from '@/modules/users/entities/user.entity';
import { Client } from '@/modules/clients/entities/client.entity';
import { ClientAddress } from '@/modules/client-addresses/entities/client-address.entity';
import { ShipmentEvidence } from './shipment-evidence.entity';

@Entity('orders')
@Index('idx_orders_dashboard', ['status', 'priorityLevel'])
@Index('idx_orders_bind_id', ['bindId'], { unique: true })
@Index('idx_tracking_active', ['trackingHash'], {
  where: "status = 'IN_TRANSIT'",
})
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bind_id', type: 'varchar', length: 50, unique: true })
  bindId: string;

  @Column({ name: 'order_number', type: 'varchar', length: 50, nullable: true, comment: 'Número de pedido Bind (ej: PE2945)' })
  orderNumber: string | null;

  @Column({ name: 'warehouse_name', type: 'varchar', length: 100, nullable: true, comment: 'Almacén de origen' })
  warehouseName: string | null;

  @Column({ name: 'employee_name', type: 'varchar', length: 100, nullable: true, comment: 'Vendedor/Empleado asignado' })
  employeeName: string | null;

  @Column({ name: 'client_number', type: 'varchar', length: 50, nullable: true, comment: 'Número de cliente en Bind' })
  clientNumber: string | null;

  @Column({ name: 'purchase_order', type: 'varchar', length: 100, nullable: true, comment: 'Orden de compra del cliente' })
  purchaseOrder: string | null;

  @Column({ name: 'client_name', type: 'varchar', length: 200 })
  clientName: string;

  @Column({ name: 'client_email', type: 'varchar', length: 150 })
  clientEmail: string;

  @Column({ name: 'client_phone', type: 'varchar', length: 20, nullable: true })
  clientPhone: string | null;

  @Column({ name: 'client_rfc', type: 'varchar', length: 15, nullable: true })
  clientRfc: string | null;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  @Index('idx_orders_client_id')
  clientId: string | null;

  @Column({ name: 'bind_client_id', type: 'varchar', length: 50, nullable: true, comment: 'UUID del cliente en Bind ERP (para sincronizar direcciones)' })
  bindClientId: string | null;

  @Column({ name: 'delivery_address_id', type: 'uuid', nullable: true, comment: 'Referencia a la dirección de entrega del cliente' })
  @Index('idx_orders_delivery_address')
  deliveryAddressId: string | null;

  @ManyToOne(() => ClientAddress, { nullable: true })
  @JoinColumn({ name: 'delivery_address_id' })
  deliveryAddress: ClientAddress | null;

  @Column({
    name: 'address_raw',
    type: 'jsonb',
    comment: 'Objeto completo {calle, num, col, cp, ciudad}',
  })
  addressRaw: {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    reference?: string;
  };

  @Column({
    name: 'address_geo',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  @Index('idx_orders_geo', { spatial: true })
  addressGeo: string | null;

  @Column({
    name: 'latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude: number | null;

  @Column({
    name: 'longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  @Column({
    name: 'priority_level',
    type: 'smallint',
    default: PriorityLevel.NORMAL,
    comment: '1=Normal, 2=Alta ($), 3=Critica (Urgente/VIP)',
  })
  priorityLevel: PriorityLevel;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({ name: 'is_vip', default: false })
  isVip: boolean;

  @Column({ name: 'promised_date', type: 'date', nullable: true })
  promisedDate: Date | null;

  @Column({
    name: 'route_position',
    type: 'smallint',
    nullable: true,
    comment: 'Secuencia en la ruta (1..N)',
  })
  routePosition: number | null;

  @Column({
    name: 'estimated_arrival_start',
    type: 'timestamp',
    nullable: true,
    comment: 'Inicio ventana ETA',
  })
  estimatedArrivalStart: Date | null;

  @Column({
    name: 'estimated_arrival_end',
    type: 'timestamp',
    nullable: true,
    comment: 'Fin ventana ETA',
  })
  estimatedArrivalEnd: Date | null;

  @Column({
    name: 'tracking_hash',
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
    comment: 'Token HMAC para URL publica de rastreo',
  })
  trackingHash: string | null;

  @Column({
    name: 'tracking_expires_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Caducidad del link de rastreo (24h post-entrega)',
  })
  trackingExpiresAt: Date | null;

  @Column({
    name: 'dispatch_email_sent',
    default: false,
    comment: 'Flag de control envio email ETA',
  })
  dispatchEmailSent: boolean;

  @Column({
    name: 'delivery_email_sent',
    default: false,
    comment: 'Flag de control envio email confirmacion',
  })
  deliveryEmailSent: boolean;

  @Column({
    name: 'csat_score',
    type: 'smallint',
    nullable: true,
    comment: '1-5 Estrellas de satisfaccion',
  })
  csatScore: number | null;

  @Column({ name: 'csat_feedback', type: 'text', nullable: true })
  csatFeedback: string | null;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'assigned_driver_id', type: 'uuid', nullable: true })
  assignedDriverId: string | null;

  @Column({
    name: 'carrier_type',
    type: 'varchar',
    length: 20,
    default: CarrierType.INTERNAL,
    comment: 'Tipo de transportista: interno o paquetería externa',
  })
  carrierType: CarrierType;

  @Column({
    name: 'carrier_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Nombre del carrier (para tipo OTHER)',
  })
  carrierName: string | null;

  @Column({
    name: 'carrier_tracking_number',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Número de guía de la paquetería externa',
  })
  carrierTrackingNumber: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.assignedOrders, { nullable: true })
  @JoinColumn({ name: 'assigned_driver_id' })
  assignedDriver: User | null;

  @ManyToOne(() => Client, (client) => client.orders, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @OneToMany(() => ShipmentEvidence, (evidence) => evidence.order)
  evidences: ShipmentEvidence[];
}
