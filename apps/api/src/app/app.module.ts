import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@tarbya/db';
import { resolve } from 'node:path';
import { validateEnv } from '../config/env';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '.env'),
      validate: validateEnv,
    }),
    DbModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
