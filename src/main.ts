import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
   const config = new DocumentBuilder()
    .setTitle('GPS Tracking API')
    .setDescription('API for managing GPS tracking data')
    .setVersion('1.0')
    .addTag('reports')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.enableCors();
  new ValidationPipe({
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  })
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
