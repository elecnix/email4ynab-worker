import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
		deps: {
			optimizer: {
				ssr: {
					// Fix TypeError: Cannot use require() to import an ES Module.
					// https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#module-resolution
					enabled: true,
					include: ['inngest'],
				},
			},
		},
	},
});
