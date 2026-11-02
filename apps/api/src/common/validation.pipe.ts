import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from './app-exception';

function collect(
  errors: ValidationError[],
  prefix = '',
  into: Record<string, string[]> = {},
) {
  for (const e of errors) {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    if (e.constraints) into[path] = Object.values(e.constraints);
    if (e.children?.length) collect(e.children, path, into);
  }
  return into;
}

export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new AppException(400, {
      code: 'VALIDATION_FAILED',
      title: 'Invalid request',
      errors: collect(errors),
    }),
});
