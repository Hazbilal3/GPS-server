// deliveries.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Driver } from '../drivers/drivers.entity';

@Entity()
export class Delivery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  driverId?: number;

  @ManyToOne(() => Driver, (driver) => driver.deliveries)
  driver: Driver;

  @Column()
  barcode: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  gpsLocation?: string;

  @Column({ type: 'float', nullable: true })
  expectedLat?: number;

  @Column({ type: 'float', nullable: true })
  expectedLng?: number;

  @Column({ type: 'float', nullable: true })
  distanceKm?: number;

  @Column()
  status: string;

  @Column({ nullable: true })
  googleMapsLink?: string;

  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;
}
