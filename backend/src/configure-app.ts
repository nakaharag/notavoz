import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

export function configureApp(app: INestApplication): void {
  // Dev clients retain their existing unprefixed endpoints.
  if (process.env.API_PREFIX) app.setGlobalPrefix(process.env.API_PREFIX);
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '256kb' }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
