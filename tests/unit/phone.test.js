import { describe, expect, it } from '@jest/globals';
import { DIAL_OPTIONS, countryFromPhone } from '../../src/domain/shared/phone.js';

describe('countryFromPhone', () => {
  it('maps common prefixes', () => {
    expect(countryFromPhone('919876543210')).toBe('IN');
    expect(countryFromPhone('971501234567')).toBe('AE');
    expect(countryFromPhone('447911123456')).toBe('GB');
    expect(countryFromPhone('12025550123')).toBe('US');
    expect(countryFromPhone('77012345678')).toBe('KZ');
    expect(countryFromPhone('79161234567')).toBe('RU');
  });
  it('prefers the longest prefix and returns null when unknown', () => {
    expect(countryFromPhone('353851234567')).toBe('IE');
    expect(countryFromPhone('99999999999')).toBeNull();
  });
  it('offers a country picker with India first', () => {
    expect(DIAL_OPTIONS[0]).toEqual(['IN', 'India', '91']);
    expect(DIAL_OPTIONS.find(([iso]) => iso === 'AE')[2]).toBe('971');
  });
});
