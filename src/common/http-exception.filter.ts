import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCodes } from './codes';
import { DomainException } from './domain.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof DomainException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (status === HttpStatus.BAD_REQUEST) {
        const message = this.extractValidationMessage(exceptionResponse);
        response.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message,
        });
        return;
      }

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'success' in exceptionResponse &&
        'code' in exceptionResponse
      ) {
        response.status(status).json(exceptionResponse);
        return;
      }

      const message = this.extractValidationMessage(exceptionResponse);
      response.status(status).json({
        success: false,
        code:
          status === HttpStatus.UNAUTHORIZED
            ? ErrorCodes.TOKEN_EXPIRED
            : status === HttpStatus.TOO_MANY_REQUESTS
              ? ErrorCodes.TOO_MANY_REQUESTS
              : ErrorCodes.INTERNAL,
        message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      code: ErrorCodes.INTERNAL,
      message: ErrorCodes.INTERNAL,
    });
  }

  private extractValidationMessage(exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const { message } = exceptionResponse as { message: unknown };
      if (Array.isArray(message)) {
        return message.join('; ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }

    return ErrorCodes.INVALID_INPUT;
  }
}
