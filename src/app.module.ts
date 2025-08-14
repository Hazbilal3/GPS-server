import { UploadService } from 'src/upload/upload.service';
import { GeocodeService } from './geocode/geocode.service';
import { UploadController } from './upload/upload.controller';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { User } from './user/user.entity';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

@Module({
  // eslint-disable-next-line prettier/prettier
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
  ],
  controllers: [UploadController, ],
  providers: [UploadService, GeocodeService, PrismaService, ],
})
export class AppModule {}
