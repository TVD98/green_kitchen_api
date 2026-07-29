import { buildRecipeGenerationPrompt } from './gemini.service';

describe('buildRecipeGenerationPrompt', () => {
  it('includes preferences and allergen exclusions when provided', () => {
    const prompt = buildRecipeGenerationPrompt(
      ['tôm', 'bắp'],
      { max_time: 30, tags: ['healthy'] },
      {
        original_prompt: 'Tôi đang thèm cay',
        cravings: ['cay'],
        preferences: {
          spice_level: 'hot',
          cuisine_preferences: ['vietnamese'],
        },
        excludeIngredients: ['đậu phộng'],
      },
    );

    expect(prompt).toContain('Original user prompt: Tôi đang thèm cay');
    expect(prompt).toContain('"spice_level":"hot"');
    expect(prompt).toContain('STRICTLY DO NOT use these allergen ingredients');
    expect(prompt).toContain('đậu phộng');
    expect(prompt).toContain('"max_time":30');
  });

  it('works without discovery context', () => {
    const prompt = buildRecipeGenerationPrompt(['trứng'], { difficulty: 'easy' });

    expect(prompt).toContain('["trứng"]');
    expect(prompt).not.toContain('User preferences');
    expect(prompt).not.toContain('STRICTLY DO NOT');
  });
});
