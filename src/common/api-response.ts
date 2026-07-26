import { SetMetadata } from '@nestjs/common';

export const RESPONSE_CODE_KEY = 'response_code';

export type SuccessMeta = { code: string };

export const ResponseCode = (code: string) =>
  SetMetadata(RESPONSE_CODE_KEY, code);

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  code: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
}

export interface ControllerEnvelope<T = unknown> {
  code: string;
  data: T;
}
