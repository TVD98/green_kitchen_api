import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type SeedIngredient = {
  canonicalName: string;
  nameEn: string;
  category: string;
  aliasesVi: string[];
  aliasesEn: string[];
};

const ingredients: SeedIngredient[] = [
  {
    canonicalName: 'thịt heo',
    nameEn: 'pork',
    category: 'protein',
    aliasesVi: ['thit heo', 'thịt lợn', 'thit lon'],
    aliasesEn: [],
  },
  {
    canonicalName: 'thịt gà',
    nameEn: 'chicken',
    category: 'protein',
    aliasesVi: ['thit ga', 'ga'],
    aliasesEn: [],
  },
  {
    canonicalName: 'thịt bò',
    nameEn: 'beef',
    category: 'protein',
    aliasesVi: ['thit bo', 'bo'],
    aliasesEn: [],
  },
  {
    canonicalName: 'cá',
    nameEn: 'fish',
    category: 'protein',
    aliasesVi: ['ca'],
    aliasesEn: [],
  },
  {
    canonicalName: 'tôm',
    nameEn: 'shrimp',
    category: 'protein',
    aliasesVi: ['tom'],
    aliasesEn: ['prawn'],
  },
  {
    canonicalName: 'trứng',
    nameEn: 'egg',
    category: 'protein',
    aliasesVi: ['trung'],
    aliasesEn: ['eggs'],
  },
  {
    canonicalName: 'đậu phụ',
    nameEn: 'tofu',
    category: 'protein',
    aliasesVi: ['dau phu', 'đậu hũ', 'dau hu'],
    aliasesEn: [],
  },
  {
    canonicalName: 'gạo',
    nameEn: 'rice',
    category: 'carb',
    aliasesVi: ['gao'],
    aliasesEn: [],
  },
  {
    canonicalName: 'bún',
    nameEn: 'rice vermicelli',
    category: 'carb',
    aliasesVi: ['bun', 'bun tuoi'],
    aliasesEn: [],
  },
  {
    canonicalName: 'mì',
    nameEn: 'noodle',
    category: 'carb',
    aliasesVi: ['mi', 'mì trứng'],
    aliasesEn: ['noodles'],
  },
  {
    canonicalName: 'hành lá',
    nameEn: 'green onion',
    category: 'vegetable',
    aliasesVi: ['hanh la'],
    aliasesEn: ['scallion', 'spring onion'],
  },
  {
    canonicalName: 'tỏi',
    nameEn: 'garlic',
    category: 'aromatic',
    aliasesVi: ['toi'],
    aliasesEn: [],
  },
  {
    canonicalName: 'gừng',
    nameEn: 'ginger',
    category: 'aromatic',
    aliasesVi: ['gung'],
    aliasesEn: [],
  },
  {
    canonicalName: 'hành tây',
    nameEn: 'onion',
    category: 'vegetable',
    aliasesVi: ['hanh tay'],
    aliasesEn: ['yellow onion'],
  },
  {
    canonicalName: 'cà chua',
    nameEn: 'tomato',
    category: 'vegetable',
    aliasesVi: ['ca chua'],
    aliasesEn: ['tomatoes'],
  },
  {
    canonicalName: 'cà rốt',
    nameEn: 'carrot',
    category: 'vegetable',
    aliasesVi: ['ca rot'],
    aliasesEn: ['carrots'],
  },
  {
    canonicalName: 'khoai tây',
    nameEn: 'potato',
    category: 'vegetable',
    aliasesVi: ['khoai tay'],
    aliasesEn: ['potatoes'],
  },
  {
    canonicalName: 'rau muống',
    nameEn: 'water spinach',
    category: 'vegetable',
    aliasesVi: ['rau muong'],
    aliasesEn: ['morning glory'],
  },
  {
    canonicalName: 'cải thảo',
    nameEn: 'napa cabbage',
    category: 'vegetable',
    aliasesVi: ['cai thao'],
    aliasesEn: ['chinese cabbage'],
  },
  {
    canonicalName: 'nấm',
    nameEn: 'mushroom',
    category: 'vegetable',
    aliasesVi: ['nam'],
    aliasesEn: ['mushrooms'],
  },
  {
    canonicalName: 'sả',
    nameEn: 'lemongrass',
    category: 'aromatic',
    aliasesVi: ['sa'],
    aliasesEn: ['lemon grass'],
  },
  {
    canonicalName: 'ớt',
    nameEn: 'chili',
    category: 'spice',
    aliasesVi: ['ot'],
    aliasesEn: ['chilli', 'pepper'],
  },
  {
    canonicalName: 'tiêu',
    nameEn: 'black pepper',
    category: 'spice',
    aliasesVi: ['tieu'],
    aliasesEn: ['peppercorn'],
  },
  {
    canonicalName: 'muối',
    nameEn: 'salt',
    category: 'seasoning',
    aliasesVi: ['muoi'],
    aliasesEn: [],
  },
  {
    canonicalName: 'đường',
    nameEn: 'sugar',
    category: 'seasoning',
    aliasesVi: ['duong'],
    aliasesEn: [],
  },
  {
    canonicalName: 'nước mắm',
    nameEn: 'fish sauce',
    category: 'seasoning',
    aliasesVi: ['nuoc mam'],
    aliasesEn: [],
  },
  {
    canonicalName: 'dầu ăn',
    nameEn: 'cooking oil',
    category: 'seasoning',
    aliasesVi: ['dau an'],
    aliasesEn: ['oil', 'vegetable oil'],
  },
  {
    canonicalName: 'sữa',
    nameEn: 'milk',
    category: 'dairy',
    aliasesVi: ['sua'],
    aliasesEn: [],
  },
  {
    canonicalName: 'bơ',
    nameEn: 'butter',
    category: 'dairy',
    aliasesVi: ['bo'],
    aliasesEn: [],
  },
  {
    canonicalName: 'phô mai',
    nameEn: 'cheese',
    category: 'dairy',
    aliasesVi: ['pho mai'],
    aliasesEn: [],
  },
  {
    canonicalName: 'ngò',
    nameEn: 'cilantro',
    category: 'herb',
    aliasesVi: ['ngo', 'ngò rí'],
    aliasesEn: ['coriander'],
  },
  {
    canonicalName: 'nước tương',
    nameEn: 'soy sauce',
    category: 'seasoning',
    aliasesVi: ['nuoc tuong', 'xì dầu', 'xi dau'],
    aliasesEn: [],
  },
];

async function main(): Promise<void> {
  for (const item of ingredients) {
    await prisma.ingredient.upsert({
      where: { canonicalName: item.canonicalName },
      update: {
        nameEn: item.nameEn,
        category: item.category,
        aliasesVi: item.aliasesVi,
        aliasesEn: item.aliasesEn,
      },
      create: item,
    });
  }

  const count = await prisma.ingredient.count();
  console.log(`Seeded ingredients: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
