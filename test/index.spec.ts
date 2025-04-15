// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractEmailCode, parseEmailHeaders } from '../src/email-utils';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;


describe('Worker Utils', () => {
	describe('extractEmailCode', () => {
		it('should extract valid email codes', () => {
			expect(extractEmailCode('fw+12345678@email4ynab.com')).toBe('12345678');
			expect(extractEmailCode('fw+abcdefgh@email4ynab.com')).toBe('abcdefgh');
			expect(extractEmailCode('fw+ABCDEFGH@email4ynab.com')).toBe('abcdefgh'); // Should be lowercase
			expect(extractEmailCode('fw+1234ABCD@email4ynab.com')).toBe('1234abcd');
			expect(extractEmailCode('fw+abc123def456gh789xyz0001@email4ynab.com')).toBe('abc123def456gh789xyz0001'); // 24 chars
			expect(extractEmailCode('fw+12345678901234567890123456789012@email4ynab.com')).toBe('12345678901234567890123456789012'); // 32 chars
		});

		it('should return null for invalid email codes', () => {
			expect(extractEmailCode('fw+invalid_!@#@example.com')).toBeNull(); // Non-alphanumeric
			expect(extractEmailCode('fw+short@email4ynab.com')).toBeNull(); // Too short
			expect(extractEmailCode('fw+1234567@email4ynab.com')).toBeNull(); // 7 chars (too short)
			expect(extractEmailCode('fw+123456789012345678901234567890123@email4ynab.com')).toBeNull(); // 33 chars (too long)
			expect(extractEmailCode('fw+@email4ynab.com')).toBeNull(); // Empty code
			expect(extractEmailCode('fw12345678@email4ynab.com')).toBeNull(); // Missing plus
			expect(extractEmailCode('12345678@email4ynab.com')).toBeNull(); // Missing fw+
			expect(extractEmailCode('invalid@example.com')).toBeNull(); // No fw+
			expect(extractEmailCode('test@gmail.com')).toBeNull();
			expect(extractEmailCode('')).toBeNull();
		});
	});

	describe('parseEmailHeaders', () => {
		it('should parse standard headers', () => {
			const rawEmail = 'From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Test\r\n\r\nBody';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(from).toBe('sender@example.com');
			expect(to).toBe('recipient@example.com');
			expect(headers['subject']).toBe('Test');
			expect(headers['from']).toBe('sender@example.com');
			expect(headers['to']).toBe('recipient@example.com');
		});

		it('should handle case-insensitivity in header names', () => {
			const rawEmail = 'FROM: sender@example.com\r\nTO: recipient@example.com\r\nSUBJECT: Test\r\n\r\nBody';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(from).toBe('sender@example.com');
			expect(to).toBe('recipient@example.com');
			expect(headers['subject']).toBe('Test');
		});

		it('should handle extra whitespace', () => {
			const rawEmail = 'From:  sender@example.com \r\nTo:\trecipient@example.com\r\nSubject: Test\r\n\r\nBody';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(from).toBe('sender@example.com');
			expect(to).toBe('recipient@example.com');
			expect(headers['subject']).toBe('Test');
		});

		it('should handle folded headers', () => {
			const rawEmail = 'From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: This is a very long subject line that is\r\n folded onto the next line\r\n\r\nBody';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(headers['subject']).toBe('This is a very long subject line that is folded onto the next line');
		});

		it('should return empty strings if From/To are missing', () => {
			const rawEmail = 'Subject: Test\r\n\r\nBody';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(from).toBe('');
			expect(to).toBe('');
			expect(headers['subject']).toBe('Test');
		});

		it('should handle emails with no headers', () => {
			const rawEmail = '\r\nBody only';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(from).toBe('');
			expect(to).toBe('');
			expect(Object.keys(headers).length).toBe(0);
		});
		it('should handle different line endings (LF)', () => {
			const rawEmail = 'From: sender@example.com\nTo: recipient@example.com\nSubject: Test\n\nBody';
			const { headers, from, to } = parseEmailHeaders(rawEmail);
			expect(from).toBe('sender@example.com');
			expect(to).toBe('recipient@example.com');
			expect(headers['subject']).toBe('Test');
		});
	});
});


// Mock the Inngest client
vi.mock('inngest', () => {
	return {
		Inngest: vi.fn().mockImplementation(() => {
			return {
				send: vi.fn().mockResolvedValue({}),
			};
		}),
	};
});

// Import the worker after mocking dependencies
import worker from '../src/index';

describe('Worker Handlers', () => {
	// Mock environment
	const mockEnv = {
		INNGEST_EVENT_KEY: {
			get: vi.fn().mockResolvedValue('test-event-key'),
		},
		INNGEST_SIGNING_KEY: {
			get: vi.fn().mockResolvedValue('test-signing-key'),
		},
		INNGEST_SIGNING_KEY_FALLBACK: {
			get: vi.fn().mockResolvedValue('test-fallback-key'),
		},
	};

	// Mock email message
	const createMockEmailMessage = (to: string) => {
		const rawContent = 'From: sender@example.com\r\n' +
			`To: ${to}\r\n` +
			'Subject: Test Email\r\n\r\n' +
			'This is a test email body';
		const encodedContent = new TextEncoder().encode(rawContent);

		const mockHeaders = new Headers();
		mockHeaders.set('subject', 'Test Email');

		return {
			from: 'sender@example.com',
			to,
			headers: mockHeaders,
			raw: new ReadableStream({
				start(controller) {
					controller.enqueue(encodedContent);
					controller.close();
				}
			}),
			rawSize: encodedContent.byteLength,
			forward: vi.fn(),
			reply: vi.fn(),
			setReject: vi.fn(),
		};
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('email handler', () => {
		it('should process valid emails', async () => {
			const mockMessage = createMockEmailMessage('fw+12345678@email4ynab.com');

			await worker.email(mockMessage, mockEnv);

			// Verify the email was not rejected
			expect(mockMessage.setReject).not.toHaveBeenCalled();
		});

		it('should reject invalid emails', async () => {
			const mockMessage = createMockEmailMessage('invalid@example.com');

			await worker.email(mockMessage, mockEnv);

			// Verify the email was rejected
			expect(mockMessage.setReject).toHaveBeenCalledWith('Invalid email recipient');
		});
	});

	describe('fetch handler', () => {
		// Define expected response structure
		interface FetchResponse {
			success: boolean;
			emailCode: string | null;
		}

		it('should process valid POST requests with raw email content', async () => {
			const mockRequest = new Request('http://localhost/', {
				method: 'POST',
				body: 'From: sender@example.com\r\nTo: fw+12345678@email4ynab.com\r\nSubject: Test Email\r\n\r\nThis is a test email body',
			});

			const response = await worker.fetch(mockRequest, mockEnv);

			expect(response.status).toBe(200);
			const responseBody = await response.json() as FetchResponse; // Cast to known type
			expect(responseBody.success).toBe(true);
			expect(responseBody.emailCode).toBe('12345678');
		});

		it('should reject POST requests with invalid email addresses', async () => {
			const mockRequest = new Request('http://localhost/', {
				method: 'POST',
				body: 'From: sender@example.com\r\nTo: invalid@example.com\r\nSubject: Test Email\r\n\r\nThis is a test email body',
			});

			const response = await worker.fetch(mockRequest, mockEnv);

			expect(response.status).toBe(400);
		});

		it('should reject non-POST requests', async () => {
			const mockRequest = new Request('http://localhost/', {
				method: 'GET',
			});

			const response = await worker.fetch(mockRequest, mockEnv);

			expect(response.status).toBe(405);
		});
	});
});
