import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './deliveries/deliveries.entity';
import { Driver } from './drivers/drivers.entity';
import { GeocodeService } from './geocode/geocode.service';
import { MatchService } from './match/match.service';
import { Mismatch } from './mismatches/mismatches.entity';
import { ReportController } from './report/report.controller';
import { UploadController } from './upload/upload.controller';
import { UploadService } from './upload/upload.service';
import { ValidateController } from './validate/validate.controller';
import { ValidateService } from './validate/validate.service';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

@Module({
  // eslint-disable-next-line prettier/prettier
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [Driver, Delivery, Mismatch],
      synchronize: false, // Turn off for production
      migrationsRun: true, // Automatically run migrations on startup
      migrations: ['dist/migrations/*.js'],
      autoLoadEntities: true,
    }),
    TypeOrmModule.forFeature([Driver, Delivery, Mismatch]),
  ],
  controllers: [UploadController, ValidateController, ReportController],
  providers: [UploadService, GeocodeService, MatchService, ValidateService],
})
export class AppModule {}
