// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker, { extractEmailCode } from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;


describe('Worker Utils', () => {
	describe('extractEmailCode', () => {
	  it('should extract valid email codes', () => {
		expect(extractEmailCode('12345678@email4ynab.com')).toBe('12345678');
		expect(extractEmailCode('abcdefgh@email4ynab.com')).toBe('abcdefgh');
		expect(extractEmailCode('ABCDEFGH@email4ynab.com')).toBe('abcdefgh'); // Should be lowercase
		expect(extractEmailCode('1234ABCD@email4ynab.com')).toBe('1234abcd');
	  });
  
	  it('should return null for invalid email codes', () => {
		expect(extractEmailCode('invalid@example.com')).toBeNull();
		expect(extractEmailCode('test@gmail.com')).toBeNull();
		expect(extractEmailCode('')).toBeNull();
		expect(extractEmailCode('123456@email4ynab.com')).toBeNull(); // Too short
		expect(extractEmailCode('123456789@email4ynab.com')).toBeNull(); // Too long
	  });
	});
  });