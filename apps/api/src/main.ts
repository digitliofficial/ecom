import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableCors({
    origin: [
      'http://localhost:3005',
      'http://127.0.0.1:3005',
      'http://demo.localhost:3005',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://demo.localhost:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3003',
    ],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Cart-Token',
      'X-Forwarded-Host',
      'X-Tenant-Host',
      'X-Platform-Key',
      'Cookie',
    ],
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on :${port}`);
}

void bootstrap();
