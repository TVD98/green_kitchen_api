import { SchemaType, type ResponseSchema } from '@google/generative-ai';

export const GENERATED_RECIPES_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    recipes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          time_minutes: { type: SchemaType.INTEGER },
          difficulty: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['easy', 'medium', 'hard'],
          },
          servings: { type: SchemaType.INTEGER },
          tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          steps: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                order: { type: SchemaType.INTEGER },
                text: { type: SchemaType.STRING },
              },
              required: ['order', 'text'],
            },
          },
          ingredients: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                quantity: { type: SchemaType.STRING },
              },
              required: ['name', 'quantity'],
            },
          },
          nutrition: {
            type: SchemaType.OBJECT,
            properties: {
              calories: { type: SchemaType.NUMBER },
              protein_g: { type: SchemaType.NUMBER },
              carbs_g: { type: SchemaType.NUMBER },
              fat_g: { type: SchemaType.NUMBER },
            },
          },
        },
        required: [
          'title',
          'description',
          'time_minutes',
          'difficulty',
          'servings',
          'tags',
          'steps',
          'ingredients',
        ],
      },
    },
  },
  required: ['recipes'],
};

export const NORMALIZE_INGREDIENTS_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    names: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ['names'],
};
