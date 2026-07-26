import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const context = {} as ExecutionContext;

  it('maps { code, data } to success envelope', async () => {
    const next: CallHandler = {
      handle: () => of({ code: 'LOGIN_SUCCESS', data: { ok: true } }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      success: true,
      code: 'LOGIN_SUCCESS',
      data: { ok: true },
    });
  });

  it('wraps plain body with OK code', async () => {
    const next: CallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      success: true,
      code: 'OK',
      data: { status: 'ok' },
    });
  });
});
