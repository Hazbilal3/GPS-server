import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Delivery } from 'src/deliveries/deliveries.entity';

@Entity()
export class Driver {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Delivery, (delivery) => delivery.driver)
  deliveries: Delivery[];
}
