import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Driver } from 'src/drivers/drivers.entity';

@Entity()
export class Delivery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  barcode: string;

  @Column()
  sequence_number: number;

  @Column()
  address: string;

  @Column()
  event: string;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date | null;

  @Column('float')
  latitude: number;

  @Column('float')
  longitude: number;

  @ManyToOne(() => Driver, (driver) => driver.deliveries)
  driver: Driver;
}
