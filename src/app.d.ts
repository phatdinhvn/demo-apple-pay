// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	namespace Cloudflare {
		interface Env {
			/** PKCS#8 PEM of the Payment Processing Certificate private key (wrangler secret). */
			APPLE_PAY_PPC_PRIVATE_KEY?: string;
		}
	}
}

export {};
