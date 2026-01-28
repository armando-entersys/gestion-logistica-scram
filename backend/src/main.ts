import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable default body parser to use custom one with higher limit
    bodyParser: false,
  });

  // Increase body size limit for base64 image uploads (50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // CORS Configuration
  app.enableCors({
    origin: [
      'https://gestion-logistica.scram2k.com',
      'https://app-gestion-logistica.scram2k.com',
      'https://scram.entersys.mx',
      'https://app-scram.entersys.mx',
      'http://localhost:3001',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('SCRAM API')
    .setDescription('Sistema de Gestión Logística SCRAM - API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación y autorización')
    .addTag('orders', 'Gestión de pedidos')
    .addTag('users', 'Gestión de usuarios')
    .addTag('routes', 'Gestión de rutas')
    .addTag('sync', 'Sincronización con Bind ERP')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`SCRAM API running on port ${port}`);
  console.log(`Swagger docs available at /api/docs`);
}

bootstrap();
