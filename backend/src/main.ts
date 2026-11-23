import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY obrigatoria em producao');
  }
  process.umask(0o077);
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  app.enableShutdownHooks();
  const server = await app.listen(3000);
  server.requestTimeout = 135_000;
  server.headersTimeout = 15_000;
  server.setTimeout(135_000, socket => socket.destroy());
}
bootstrap();
