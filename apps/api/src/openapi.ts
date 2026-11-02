import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Tarbya API')
    .setVersion('0.1.0')
    .addCookieAuth('access_token')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(app: INestApplication) {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api/openapi.json',
  });
}
