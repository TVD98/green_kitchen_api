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
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@example.com' } },
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
});
