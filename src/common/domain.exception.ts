import { HttpException } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    status: number,
    message?: string,
  ) {
    super({ success: false, code, message: message ?? code }, status);
  }
}
