import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './crypto';

describe('Crypto Utilities', () => {
  describe('hashPassword', () => {
    it('should return a string hash for a given password', async () => {
      const password = 'mysecretpassword';
      const hash = await hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      // Basic check for bcrypt hash format ($2a$, $2b$, $2y$)
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    });

    it('should produce different hashes for the same password with different salts', async () => {
      const password = 'mysecretpassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for a correct password and hash combination', async () => {
      const password = 'mysecretpassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const password = 'mysecretpassword';
      const wrongPassword = 'anotherpassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should return false for an invalid hash format', async () => {
      const password = 'mysecretpassword';
      const invalidHash = 'not_a_real_hash';
      const isValid = await verifyPassword(password, invalidHash);

      expect(isValid).toBe(false);
    });
  });
}); 