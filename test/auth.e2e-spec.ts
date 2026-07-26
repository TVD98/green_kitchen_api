import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const deviceInfo = {
    device_id: 'dev1',
    platform: 'android',
    os_version: '14',
    app_version: '1.0.0',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.refreshToken.deleteMany();
    await prisma.otpSession.deleteMany({
      where: {
        OR: [
          { email: { endsWith: '@example.com' } },
          { email: { endsWith: '@social.greenkitchen.app' } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: '@example.com' } },
          { email: { endsWith: '@social.greenkitchen.app' } },
        ],
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('signs up and logs in with envelope shape', async () => {
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'a@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);
    expect(signup.body.success).toBe(true);
    expect(signup.body.code).toBe('SIGNUP_SUCCESS');
    expect(signup.body.data.user.email).toBe('a@example.com');
    expect(signup.body.data.tokens.access_token).toBeDefined();
    expect(signup.body.data.tokens.refresh_token).toBeDefined();
    expect(signup.body.data.tokens.token_type).toBe('Bearer');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'a@example.com',
        password: 'Password1!',
        device_id: 'dev1',
      })
      .expect(200);
    expect(login.body.success).toBe(true);
    expect(login.body.code).toBe('LOGIN_SUCCESS');
    expect(login.body.data.user.email).toBe('a@example.com');
    expect(login.body.data.tokens.access_token).toBeDefined();
    expect(login.body.data.tokens.refresh_token).toBeDefined();
  });

  it('refreshes access token and logs out', async () => {
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'refresh@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);

    const refreshToken = signup.body.data.tokens.refresh_token as string;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({
        refresh_token: refreshToken,
        device_id: 'dev1',
      })
      .expect(200);
    expect(refreshed.body.success).toBe(true);
    expect(refreshed.body.data.access_token).toBeDefined();
    expect(refreshed.body.data.expires_in).toBeDefined();
    expect(refreshed.body.data.token_type).toBe('Bearer');

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refresh_token: refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({
        refresh_token: refreshToken,
        device_id: 'dev1',
      })
      .expect(401);
  });

  it('rejects duplicate signup with ERR_USER_EXISTS', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'dup@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);

    const dup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'dup@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(400);
    expect(dup.body.success).toBe(false);
    expect(dup.body.code).toBe('ERR_USER_EXISTS');
  });

  it('rejects wrong password with ERR_INVALID_CREDENTIALS', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'badpass@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);

    const bad = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'badpass@example.com',
        password: 'WrongPass1!',
        device_id: 'dev1',
      })
      .expect(401);
    expect(bad.body.success).toBe(false);
    expect(bad.body.code).toBe('ERR_INVALID_CREDENTIALS');
  });

  it('resets password via forgot → verify OTP → reset', async () => {
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'reset@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);

    const oldRefresh = signup.body.data.tokens.refresh_token as string;

    const forgot = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200);
    expect(forgot.body.success).toBe(true);
    expect(forgot.body.code).toBe('OTP_SENT');
    expect(forgot.body.data.session_id).toBeDefined();
    expect(forgot.body.data.expire_in_seconds).toBeDefined();
    expect(forgot.body.data.resend_after_seconds).toBeDefined();
    expect(forgot.body.data.dev_otp).toMatch(/^\d{4}$/);

    const verify = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        session_id: forgot.body.data.session_id,
        otp_code: forgot.body.data.dev_otp,
        purpose: 'password_reset',
      })
      .expect(200);
    expect(verify.body.success).toBe(true);
    expect(verify.body.data.reset_token).toBeDefined();

    const reset = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        reset_token: verify.body.data.reset_token,
        new_password: 'NewPass1!',
      })
      .expect(200);
    expect(reset.body.success).toBe(true);
    expect(reset.body.code).toBe('PASSWORD_RESET_SUCCESS');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'reset@example.com',
        password: 'NewPass1!',
        device_id: 'dev1',
      })
      .expect(200);
    expect(login.body.code).toBe('LOGIN_SUCCESS');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({
        refresh_token: oldRefresh,
        device_id: 'dev1',
      })
      .expect(401);
  });

  it('social-login stub issues session; fail token is rejected', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/v1/auth/social-login')
      .send({
        provider: 'google',
        id_token: 'stub-token-ok',
        device_info: deviceInfo,
      })
      .expect(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body.code).toBe('LOGIN_SUCCESS');
    expect(ok.body.data.user.email).toMatch(/@social\.greenkitchen\.app$/);
    expect(ok.body.data.tokens.access_token).toBeDefined();
    expect(ok.body.data.tokens.refresh_token).toBeDefined();

    const fail = await request(app.getHttpServer())
      .post('/api/v1/auth/social-login')
      .send({
        provider: 'google',
        id_token: 'fail',
        device_info: deviceInfo,
      })
      .expect(401);
    expect(fail.body.success).toBe(false);
    expect(fail.body.code).toBe('ERR_SOCIAL_AUTH_FAILED');
  });

  it('forgot-password returns OTP_SENT for unknown email (no enumeration)', async () => {
    const forgot = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);
    expect(forgot.body.success).toBe(true);
    expect(forgot.body.code).toBe('OTP_SENT');
    expect(forgot.body.data.session_id).toBeDefined();
    expect(forgot.body.data.expire_in_seconds).toBeDefined();
    expect(forgot.body.data.resend_after_seconds).toBeDefined();
  });

  it('verify-otp returns ERR_INVALID_OTP for wrong code and unknown session alike', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'otp-enum@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);

    const knownForgot = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'otp-enum@example.com' })
      .expect(200);

    const unknownForgot = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost-otp@example.com' })
      .expect(200);

    const wrongCode =
      knownForgot.body.data.dev_otp === '0000' ? '1111' : '0000';
    const wrongOtp = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        session_id: knownForgot.body.data.session_id,
        otp_code: wrongCode,
        purpose: 'password_reset',
      })
      .expect(400);
    expect(wrongOtp.body.success).toBe(false);
    expect(wrongOtp.body.code).toBe('ERR_INVALID_OTP');

    const unknownSessionWrong = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        session_id: unknownForgot.body.data.session_id,
        otp_code: '0000',
        purpose: 'password_reset',
      })
      .expect(400);
    expect(unknownSessionWrong.body.success).toBe(false);
    expect(unknownSessionWrong.body.code).toBe('ERR_INVALID_OTP');

    const missingSession = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        session_id: 'clxxxxxxxxxxxxxxxxxxxxxx',
        otp_code: '1234',
        purpose: 'password_reset',
      })
      .expect(400);
    expect(missingSession.body.success).toBe(false);
    expect(missingSession.body.code).toBe('ERR_INVALID_OTP');
  });

  it('rejects OTP reuse after successful verify; reset_token still works', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'otp-once@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);

    const forgot = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'otp-once@example.com' })
      .expect(200);

    const verify = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        session_id: forgot.body.data.session_id,
        otp_code: forgot.body.data.dev_otp,
        purpose: 'password_reset',
      })
      .expect(200);
    const resetToken = verify.body.data.reset_token as string;

    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({
        session_id: forgot.body.data.session_id,
        otp_code: forgot.body.data.dev_otp,
        purpose: 'password_reset',
      })
      .expect(400);
    expect(reuse.body.success).toBe(false);
    expect(reuse.body.code).toBe('ERR_INVALID_OTP');

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        reset_token: resetToken,
        new_password: 'OncePass1!',
      })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'otp-once@example.com',
        password: 'OncePass1!',
        device_id: 'dev1',
      })
      .expect(200);
    expect(login.body.code).toBe('LOGIN_SUCCESS');
  });

  it('social-login stub does not take over an existing email user', async () => {
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: 'victim@example.com',
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);
    const victimId = signup.body.data.user.id as string;

    // Claim victim email in stub token payload — must not attach to password account.
    const claimToken = Buffer.from(
      JSON.stringify({ email: 'victim@example.com' }),
    ).toString('utf8');

    const social = await request(app.getHttpServer())
      .post('/api/v1/auth/social-login')
      .send({
        provider: 'google',
        id_token: claimToken,
        device_info: deviceInfo,
      })
      .expect(200);
    expect(social.body.code).toBe('LOGIN_SUCCESS');
    expect(social.body.data.user.email).toMatch(/@social\.greenkitchen\.app$/);
    expect(social.body.data.user.id).not.toBe(victimId);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'victim@example.com',
        password: 'Password1!',
        device_id: 'dev1',
      })
      .expect(200);
    expect(login.body.data.user.id).toBe(victimId);
  });
});
