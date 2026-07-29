import {
  DiscoveryService,
  normalizePrompt,
} from './discovery.service';
import { DiscoveryParsedIntent } from '../gemini/gemini.types';

describe('DiscoveryService helpers', () => {
  const service = Object.create(DiscoveryService.prototype) as DiscoveryService;

  it('normalizes prompt whitespace and casing', () => {
    expect(normalizePrompt('  Tôi   Đang   Thèm Cay  ')).toBe(
      'tôi đang thèm cay',
    );
  });

  it('builds generation ingredients from cravings when ingredients empty', () => {
    const parsed: DiscoveryParsedIntent = {
      ingredients: [],
      cravings: ['cay'],
      dietary_notes: [],
    };

    expect(service.buildGenerationIngredients(parsed)).toEqual(['cay']);
  });

  it('prefers parsed ingredients over cravings', () => {
    const parsed: DiscoveryParsedIntent = {
      ingredients: ['trứng'],
      cravings: ['cay'],
      dietary_notes: [],
    };

    expect(service.buildGenerationIngredients(parsed)).toEqual(['trứng']);
  });

  it('uses stable hash for identical cache payload', () => {
    const payload = {
      prompt_normalized: 'tôi đang thèm cay',
      filters: { max_time: 30 },
      options: {
        use_preferences: true,
        exclude_allergies: false,
      },
      preference_snapshot: {
        spice_level: 'hot',
        cuisine_preferences: ['vietnamese'],
      },
      allergy_ids: null,
    };

    const first = service.promptHash(payload);
    const second = service.promptHash({ ...payload });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});
