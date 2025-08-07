import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Driver } from 'src/drivers/drivers.entity'; 
import { Delivery } from 'src/deliveries/deliveries.entity';
import { Mismatch } from 'src/mismatches/mismatches.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes .env available globally
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [Driver, Delivery, Mismatch],
      synchronize: true,
      autoLoadEntities: true,
    }),
  ],
})
export class AppConfigModule {}
