import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Delivery } from 'src/deliveries/deliveries.entity';

@Entity()
export class Mismatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  expected_address: string;

  @Column()
  actual_address: string;

@Column('float', { default: 0 })
similarity_score: number;

  @ManyToOne(() => Delivery, (delivery) => delivery.mismatches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deliveryId' })
  delivery: Delivery;

  @Column({ nullable: true })
  deliveryId: number;
}
