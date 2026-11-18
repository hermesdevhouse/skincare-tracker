import { describe, expect, it } from 'vitest';

import { MAX_TEXT_LENGTH, validateProductInput } from '../../src/api/index';

describe('validateProductInput', () => {
  it('accepts a valid body and trims name and brand', () => {
    const result = validateProductInput({
      name: '  Gentle Cleanser  ',
      brand: '  Brand X  ',
      step: 'cleanser',
      session: 'am',
    });
    if (!result.ok) {
      throw new Error('expected a valid result');
    }
    expect(result.value).toEqual({
      name: 'Gentle Cleanser',
      brand: 'Brand X',
      step: 'cleanser',
      session: 'am',
    });
  });

  it('rejects a missing required field (brand) with a validation_error and a brand detail', () => {
    const result = validateProductInput({ name: 'Serum', step: 'serum', session: 'pm' });
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
    const details = result.problem.details ?? [];
    expect(details.some((detail) => detail.field === 'brand')).toBe(true);
  });

  it('rejects a whitespace-only name as empty', () => {
    const result = validateProductInput({
      name: '   ',
      brand: 'Brand',
      step: 'serum',
      session: 'am',
    });
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
    const details = result.problem.details ?? [];
    expect(details.some((detail) => detail.field === 'name')).toBe(true);
  });

  it('accepts a name of exactly MAX_TEXT_LENGTH characters', () => {
    const result = validateProductInput({
      name: 'a'.repeat(MAX_TEXT_LENGTH),
      brand: 'Brand',
      step: 'moisturiser',
      session: 'pm',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a name longer than MAX_TEXT_LENGTH characters', () => {
    const result = validateProductInput({
      name: 'a'.repeat(MAX_TEXT_LENGTH + 1),
      brand: 'Brand',
      step: 'moisturiser',
      session: 'pm',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown step', () => {
    const result = validateProductInput({
      name: 'Thing',
      brand: 'Brand',
      step: 'tonic',
      session: 'am',
    });
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
    const details = result.problem.details ?? [];
    expect(details.some((detail) => detail.field === 'step')).toBe(true);
  });

  it('rejects an unknown session', () => {
    const result = validateProductInput({
      name: 'Thing',
      brand: 'Brand',
      step: 'cleanser',
      session: 'noon',
    });
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
    const details = result.problem.details ?? [];
    expect(details.some((detail) => detail.field === 'session')).toBe(true);
  });

  it('rejects an extra property', () => {
    const result = validateProductInput({
      name: 'Thing',
      brand: 'Brand',
      step: 'cleanser',
      session: 'am',
      extra: 'nope',
    });
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
  });

  it('rejects a non-object body — a string', () => {
    const result = validateProductInput('not an object');
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
  });

  it('rejects a non-object body — an array', () => {
    const result = validateProductInput([1, 2, 3]);
    if (result.ok) {
      throw new Error('expected an invalid result');
    }
    expect(result.problem.error).toBe('validation_error');
  });
});
