import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Ingredients (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const deviceInfo = {
    device_id: 'ing-dev1',
    platform: 'android',
    os_version: '14',
    app_version: '1.0.0',
  };

  async function signupAccessToken(email: string): Promise<string> {
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email,
        password: 'Password1!',
        device_info: deviceInfo,
      })
      .expect(201);
    return signup.body.data.tokens.access_token as string;
  }

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

  it('rejects unauthenticated autocomplete with ERR_TOKEN_EXPIRED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ingredients')
      .query({ q: 'thit' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ERR_TOKEN_EXPIRED');
  });

  it('returns matching ingredients for q=thit when authenticated', async () => {
    const token = await signupAccessToken('ingredients@example.com');

    const res = await request(app.getHttpServer())
      .get('/api/v1/ingredients')
      .query({ q: 'thit' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.length).toBeLessThanOrEqual(20);

    for (const item of res.body.data) {
      expect(item).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          canonical_name: expect.any(String),
          category: expect.any(String),
          aliases: expect.any(Array),
        }),
      );
      const haystack = [
        item.canonical_name as string,
        ...(item.aliases as string[]),
      ]
        .join(' ')
        .toLowerCase();
      expect(haystack).toContain('thit');
    }
  });

  it('returns empty array when q is missing or empty', async () => {
    const token = await signupAccessToken('ingredients-empty@example.com');

    const missing = await request(app.getHttpServer())
      .get('/api/v1/ingredients')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(missing.body.success).toBe(true);
    expect(missing.body.data).toEqual([]);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/ingredients')
      .query({ q: '' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(empty.body.success).toBe(true);
    expect(empty.body.data).toEqual([]);
  });
});
