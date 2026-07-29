import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { GeminiService } from './../src/modules/gemini/gemini.service';
import { GeneratedRecipe } from './../src/modules/gemini/gemini.types';

const MOCK_PARSED_INTENT = {
  ingredients: [],
  cravings: ['cay'],
  dietary_notes: [],
};

const MOCK_RECIPES: GeneratedRecipe[] = [
  {
    title: 'Mì cay sốt me',
    description: 'Món mì cay nhanh',
    time_minutes: 20,
    difficulty: 'easy',
    servings: 2,
    tags: ['spicy', 'quick'],
    steps: [
      { order: 1, text: 'Luộc mì' },
      { order: 2, text: 'Pha sốt cay' },
    ],
    ingredients: [
      { name: 'mì', quantity: '200g' },
      { name: 'ớt', quantity: '2 quả' },
    ],
  },
];

describe('Discovery (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let parseDiscoveryPrompt: jest.Mock;
  let generateRecipes: jest.Mock;

  const deviceInfo = {
    device_id: 'discovery-dev1',
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
    parseDiscoveryPrompt = jest.fn().mockResolvedValue(MOCK_PARSED_INTENT);
    generateRecipes = jest.fn().mockResolvedValue(MOCK_RECIPES);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeminiService)
      .useValue({
        parseDiscoveryPrompt,
        generateRecipes,
        normalizeIngredients: jest
          .fn()
          .mockImplementation(async (names: string[]) => names),
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
    await prisma.discoveryQuery.deleteMany();
    await prisma.userAllergy.deleteMany();
    await prisma.userPreferences.deleteMany();
    await prisma.recipe.deleteMany({
      where: {
        OR: [{ title: { contains: 'Mì cay' } }, { source: 'gemini' }],
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

  it('searches by prompt and returns generated recipes', async () => {
    const token = await signupAccessToken('discovery@example.com');
    const body = {
      prompt: 'Tôi đang thèm: Cay. Tôi có thể nấu gì?',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/discovery/search')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        title: 'Mì cay sốt me',
        difficulty: 'easy',
      }),
    );
    expect(parseDiscoveryPrompt).toHaveBeenCalledWith(body.prompt);
    expect(generateRecipes).toHaveBeenCalledTimes(1);
  });

  it('serves cache on identical discovery search', async () => {
    const token = await signupAccessToken('discovery-cache@example.com');
    const body = {
      prompt: 'Gợi ý món chay',
      filters: { tags: ['vegetarian'] },
    };

    await request(app.getHttpServer())
      .post('/api/v1/discovery/search')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/discovery/search')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(generateRecipes).toHaveBeenCalledTimes(1);
  });

  it('passes allergen exclusions to Gemini when exclude_allergies is true', async () => {
    const token = await signupAccessToken('discovery-allergy@example.com');
    const shrimp = await prisma.ingredient.findFirst({
      where: { canonicalName: 'tôm' },
    });
    expect(shrimp).not.toBeNull();

    await request(app.getHttpServer())
      .put('/api/v1/users/me/allergies')
      .set('Authorization', `Bearer ${token}`)
      .send({ ingredient_ids: [shrimp!.id] })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/discovery/search')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Tôi muốn món hải sản',
        options: { exclude_allergies: true },
      })
      .expect(201);

    expect(generateRecipes).toHaveBeenCalledWith(
      ['cay'],
      undefined,
      expect.objectContaining({
        excludeIngredients: ['tôm'],
      }),
    );
  });

  it('roundtrips user preferences', async () => {
    const token = await signupAccessToken('prefs@example.com');

    const empty = await request(app.getHttpServer())
      .get('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(empty.body.data).toEqual({
      dietary_style: null,
      spice_level: null,
      cuisine_preferences: [],
      disliked_ingredients: [],
      health_goals: [],
    });

    await request(app.getHttpServer())
      .put('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ spice_level: 'hot', cuisine_preferences: ['vietnamese'] })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .get('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(updated.body.data.spice_level).toBe('hot');
    expect(updated.body.data.cuisine_preferences).toEqual(['vietnamese']);
  });

  it('rejects invalid allergy ingredient ids', async () => {
    const token = await signupAccessToken('bad-allergy@example.com');

    const res = await request(app.getHttpServer())
      .put('/api/v1/users/me/allergies')
      .set('Authorization', `Bearer ${token}`)
      .send({ ingredient_ids: ['does-not-exist'] })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ERR_INVALID_INPUT');
  });

  it('rejects unauthenticated discovery and profile routes', async () => {
    const discovery = await request(app.getHttpServer())
      .post('/api/v1/discovery/search')
      .send({ prompt: 'Món chay' })
      .expect(401);

    const preferences = await request(app.getHttpServer())
      .get('/api/v1/users/me/preferences')
      .expect(401);

    expect(discovery.body.code).toBe('ERR_TOKEN_EXPIRED');
    expect(preferences.body.code).toBe('ERR_TOKEN_EXPIRED');
  });
});
