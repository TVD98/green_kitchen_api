import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse, ControllerEnvelope } from './api-response';

function isControllerEnvelope(body: unknown): body is ControllerEnvelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    'data' in body &&
    typeof (body as ControllerEnvelope).code === 'string'
  );
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (isControllerEnvelope(body)) {
          return {
            success: true as const,
            code: body.code,
            data: body.data,
          };
        }

        return {
          success: true as const,
          code: 'OK',
          data: body,
        };
      }),
    );
  }
}
