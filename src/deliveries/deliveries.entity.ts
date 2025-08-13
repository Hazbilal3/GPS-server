import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Driver } from 'src/drivers/drivers.entity';
import { Mismatch } from '../mismatches/mismatches.entity';

@Entity()
export class Delivery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  barcode: string;

  @Column({ type: 'int', default: 0 })
  sequence_number: number;

  @Column()
  address: string;

  @Column({ default: 'UNKNOWN' })
event: string;

  @Column({ type: 'timestamp', nullable: true })
  timestamp: Date;

@Column('float', { nullable: true })
latitude: number;

@Column('float', { nullable: true })
  longitude: number;

  @ManyToOne(() => Driver, (driver) => driver.deliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'driverId' })
  driver: Driver;

  @Column({ nullable: true })
  driverId: number;

  @Column({ type: 'int', nullable: true })
  sequenceNumber: number;

  @OneToMany(() => Mismatch, (mismatch) => mismatch.delivery)
  mismatches: Mismatch[];
}
