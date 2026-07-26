import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type SeedIngredient = {
  canonicalName: string;
  category: string;
  aliases: string[];
};

const ingredients: SeedIngredient[] = [
  {
    canonicalName: 'thịt heo',
    category: 'protein',
    aliases: ['thit heo', 'pork', 'thịt lợn', 'thit lon'],
  },
  {
    canonicalName: 'thịt gà',
    category: 'protein',
    aliases: ['thit ga', 'chicken', 'ga'],
  },
  {
    canonicalName: 'thịt bò',
    category: 'protein',
    aliases: ['thit bo', 'beef', 'bo'],
  },
  {
    canonicalName: 'cá',
    category: 'protein',
    aliases: ['ca', 'fish'],
  },
  {
    canonicalName: 'tôm',
    category: 'protein',
    aliases: ['tom', 'shrimp', 'prawn'],
  },
  {
    canonicalName: 'trứng',
    category: 'protein',
    aliases: ['trung', 'egg', 'eggs'],
  },
  {
    canonicalName: 'đậu phụ',
    category: 'protein',
    aliases: ['dau phu', 'tofu', 'đậu hũ', 'dau hu'],
  },
  {
    canonicalName: 'gạo',
    category: 'carb',
    aliases: ['gao', 'rice'],
  },
  {
    canonicalName: 'bún',
    category: 'carb',
    aliases: ['bun', 'rice vermicelli', 'bun tuoi'],
  },
  {
    canonicalName: 'mì',
    category: 'carb',
    aliases: ['mi', 'noodle', 'noodles', 'mì trứng'],
  },
  {
    canonicalName: 'hành lá',
    category: 'vegetable',
    aliases: ['hanh la', 'green onion', 'scallion', 'spring onion'],
  },
  {
    canonicalName: 'tỏi',
    category: 'aromatic',
    aliases: ['toi', 'garlic'],
  },
  {
    canonicalName: 'gừng',
    category: 'aromatic',
    aliases: ['gung', 'ginger'],
  },
  {
    canonicalName: 'hành tây',
    category: 'vegetable',
    aliases: ['hanh tay', 'onion', 'yellow onion'],
  },
  {
    canonicalName: 'cà chua',
    category: 'vegetable',
    aliases: ['ca chua', 'tomato', 'tomatoes'],
  },
  {
    canonicalName: 'cà rốt',
    category: 'vegetable',
    aliases: ['ca rot', 'carrot', 'carrots'],
  },
  {
    canonicalName: 'khoai tây',
    category: 'vegetable',
    aliases: ['khoai tay', 'potato', 'potatoes'],
  },
  {
    canonicalName: 'rau muống',
    category: 'vegetable',
    aliases: ['rau muong', 'water spinach', 'morning glory'],
  },
  {
    canonicalName: 'cải thảo',
    category: 'vegetable',
    aliases: ['cai thao', 'napa cabbage', 'chinese cabbage'],
  },
  {
    canonicalName: 'nấm',
    category: 'vegetable',
    aliases: ['nam', 'mushroom', 'mushrooms'],
  },
  {
    canonicalName: 'sả',
    category: 'aromatic',
    aliases: ['sa', 'lemongrass', 'lemon grass'],
  },
  {
    canonicalName: 'ớt',
    category: 'spice',
    aliases: ['ot', 'chili', 'chilli', 'pepper'],
  },
  {
    canonicalName: 'tiêu',
    category: 'spice',
    aliases: ['tieu', 'black pepper', 'peppercorn'],
  },
  {
    canonicalName: 'muối',
    category: 'seasoning',
    aliases: ['muoi', 'salt'],
  },
  {
    canonicalName: 'đường',
    category: 'seasoning',
    aliases: ['duong', 'sugar'],
  },
  {
    canonicalName: 'nước mắm',
    category: 'seasoning',
    aliases: ['nuoc mam', 'fish sauce'],
  },
  {
    canonicalName: 'dầu ăn',
    category: 'seasoning',
    aliases: ['dau an', 'cooking oil', 'oil', 'vegetable oil'],
  },
  {
    canonicalName: 'sữa',
    category: 'dairy',
    aliases: ['sua', 'milk'],
  },
  {
    canonicalName: 'bơ',
    category: 'dairy',
    aliases: ['bo', 'butter'],
  },
  {
    canonicalName: 'phô mai',
    category: 'dairy',
    aliases: ['pho mai', 'cheese'],
  },
  {
    canonicalName: 'ngò',
    category: 'herb',
    aliases: ['ngo', 'cilantro', 'coriander', 'ngò rí'],
  },
  {
    canonicalName: 'nước tương',
    category: 'seasoning',
    aliases: ['nuoc tuong', 'soy sauce', 'xì dầu', 'xi dau'],
  },
];

async function main(): Promise<void> {
  for (const item of ingredients) {
    await prisma.ingredient.upsert({
      where: { canonicalName: item.canonicalName },
      update: {
        category: item.category,
        aliases: item.aliases,
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
