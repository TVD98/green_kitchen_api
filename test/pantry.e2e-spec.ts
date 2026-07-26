import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { GeminiService } from './../src/modules/gemini/gemini.service';
import { GeneratedRecipe } from './../src/modules/gemini/gemini.types';

const MOCK_RECIPES: GeneratedRecipe[] = [
  {
    title: 'Trứng chiên cà chua',
    description: 'Món trứng chiên với cà chua đơn giản',
    time_minutes: 15,
    difficulty: 'easy',
    servings: 2,
    tags: ['viet', 'quick'],
    steps: [
      { order: 1, text: 'Đập trứng vào tô' },
      { order: 2, text: 'Chiên với cà chua' },
    ],
    ingredients: [
      { name: 'trứng', quantity: '2 quả' },
      { name: 'cà chua', quantity: '1 quả' },
    ],
    nutrition: { calories: 220, protein_g: 14, carbs_g: 8, fat_g: 14 },
  },
  {
    title: 'Cà chua xào trứng',
    description: 'Cà chua xào trứng kiểu nhà',
    time_minutes: 20,
    difficulty: 'easy',
    servings: 2,
    tags: ['viet', 'home'],
    steps: [
      { order: 1, text: 'Cắt cà chua' },
      { order: 2, text: 'Xào cùng trứng' },
    ],
    ingredients: [
      { name: 'cà chua', quantity: '2 quả' },
      { name: 'trứng', quantity: '3 quả' },
    ],
  },
];

describe('Pantry (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let generateRecipes: jest.Mock;
  let normalizeIngredients: jest.Mock;

  const deviceInfo = {
    device_id: 'pantry-dev1',
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
    generateRecipes = jest.fn().mockResolvedValue(MOCK_RECIPES);
    normalizeIngredients = jest
      .fn()
      .mockImplementation(async (names: string[]) => names);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeminiService)
      .useValue({
        generateRecipes,
        normalizeIngredients,
      })
      .compile();

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
    await prisma.pantryQuery.deleteMany();
    await prisma.recipe.deleteMany({
      where: {
        OR: [
          { title: { contains: 'Trứng chiên' } },
          { title: { contains: 'Cà chua xào' } },
          { source: 'gemini' },
        ],
      },
    });
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@example.com' } },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('generates once then serves hybrid cache on identical pantry search', async () => {
    const token = await signupAccessToken('pantry@example.com');
    const body = {
      ingredients: ['trứng', 'cà chua'],
    };

    const first = await request(app.getHttpServer())
      .post('/api/v1/pantry/search')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(first.body.success).toBe(true);
    expect(Array.isArray(first.body.data)).toBe(true);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.data[0]).toEqual(
      expect.objectContaining({
        title: 'Trứng chiên cà chua',
        time_minutes: 15,
        difficulty: 'easy',
        servings: 2,
      }),
    );
    expect(generateRecipes).toHaveBeenCalledTimes(1);

    const persisted = await prisma.recipe.findMany({
      where: { title: { in: MOCK_RECIPES.map((r) => r.title) } },
    });
    expect(persisted).toHaveLength(2);

    const second = await request(app.getHttpServer())
      .post('/api/v1/pantry/search')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(second.body.success).toBe(true);
    expect(second.body.data).toHaveLength(2);
    expect(second.body.data.map((r: { title: string }) => r.title).sort()).toEqual(
      MOCK_RECIPES.map((r) => r.title).sort(),
    );
    expect(generateRecipes).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated pantry search with ERR_TOKEN_EXPIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pantry/search')
      .send({ ingredients: ['trứng'] })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ERR_TOKEN_EXPIRED');
  });
});
