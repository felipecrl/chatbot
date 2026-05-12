import { describe, expect, it } from 'vitest';
import { findSampleProperty, searchSampleProperties } from './property.fixtures';

describe('searchSampleProperties', () => {
  it('returns all sample properties when no filter is given', () => {
    expect(searchSampleProperties({}, 10)).toHaveLength(3);
  });

  it('filters by transaction type', () => {
    const results = searchSampleProperties({ transaction: 'aluguel' }, 10);
    expect(results).toHaveLength(1);
    expect(results[0]?.code).toBe('AP003');
  });

  it('filters by transaction, max price and min bedrooms', () => {
    const results = searchSampleProperties(
      { transaction: 'venda', maxPrice: 500_000, minBedrooms: 2 },
      10,
    );
    expect(results.map((p) => p.code)).toEqual(['AP001']);
  });

  it('filters by property type (case-insensitive substring)', () => {
    const results = searchSampleProperties({ type: 'casa' }, 10);
    expect(results.map((p) => p.code)).toEqual(['CS002']);
  });

  it('filters by minimum price', () => {
    const results = searchSampleProperties({ transaction: 'venda', minPrice: 500_000 }, 10);
    expect(results.map((p) => p.code)).toEqual(['CS002']);
  });

  it('filters by minimum area', () => {
    const results = searchSampleProperties({ minArea: 100 }, 10);
    expect(results.map((p) => p.code)).toEqual(['CS002']);
  });

  it('respects the limit', () => {
    expect(searchSampleProperties({}, 2)).toHaveLength(2);
  });
});

describe('findSampleProperty', () => {
  it('finds by code', () => {
    expect(findSampleProperty('CS002')?.neighborhood).toBe('Buritis');
  });

  it('returns null for unknown codes', () => {
    expect(findSampleProperty('XXX')).toBeNull();
  });
});
