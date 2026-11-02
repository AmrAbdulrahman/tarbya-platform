import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { writeFileSync } from 'node:fs';
import { AppModule } from './app/app.module';
import { buildOpenApiDocument, setupOpenApi } from './openapi';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');

  // `nx run api:openapi` writes the spec for the generated client and exits.
  const openApiOut = process.env['OPENAPI_OUT'];
  if (openApiOut) {
    writeFileSync(
      openApiOut,
      JSON.stringify(buildOpenApiDocument(app), null, 2) + '\n',
    );
    await app.close();
    return;
  }

  // Railway's proxy sets X-Forwarded-For; the throttler and sessions need the client's IP.
  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    app.set('trust proxy', 1);
  }
  app.enableShutdownHooks();
  setupOpenApi(app);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  // Set when Nx waits for this server to be ready
  if (process.env['NX_READY_SIGNAL_SOCKET']) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(
    `API listening on http://localhost:${port}/api (docs at /api/docs)`,
  );
}

bootstrap();
