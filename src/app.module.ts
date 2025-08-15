import { UploadService } from 'src/upload/upload.service';
import { GeocodeService } from './geocode/geocode.service';
import { UploadController } from './upload/upload.controller';
import { ConfigModule } from '@nestjs/config';
import { Module, ValidationPipe } from '@nestjs/common';
import { User } from './user/user.entity';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';
import { ReportController } from './report/report.controller';
import { ReportService } from './report/report.service';
import { APP_PIPE } from '@nestjs/core';

@Module({
  // eslint-disable-next-line prettier/prettier
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
  ],
  controllers: [UploadController, ReportController],
  providers: [UploadService, GeocodeService, PrismaService, ReportService,
     {
      provide: APP_PIPE,
      useClass: ValidationPipe, // Add global validation pipe
    },
  ],
})
export class AppModule {}
