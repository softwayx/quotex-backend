import { describe, expect, it } from '@jest/globals';
import { decryptSecret, encryptSecret } from '../../src/utils/crypto.js';

describe('AES-256-GCM secrets (same format as the old app)', () => {
  it('round-trips with a random IV in the v1 format', () => {
    const a = encryptSecret('ABCDE1234F');
    expect(a).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(a).not.toBe(encryptSecret('ABCDE1234F'));
    expect(decryptSecret(a)).toBe('ABCDE1234F');
  });

  it('rejects tampered ciphertext', () => {
    const [v, iv, tag, data] = encryptSecret('secret').split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });
});
