import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Delivery } from 'src/deliveries/deliveries.entity';

@Entity()
export class Mismatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  expected_address: string;

  @Column()
  actual_address: string;

  @Column()
  similarity_score: number;

  @ManyToOne(() => Delivery)
  delivery: Delivery;
}
