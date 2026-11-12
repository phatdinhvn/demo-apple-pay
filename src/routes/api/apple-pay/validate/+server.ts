import { env } from 'cloudflare:workers';
import { error, json } from '@sveltejs/kit';
import { isAppleGatewayUrl } from '#lib/server/applepay/gateway.ts';
import type { RequestHandler } from './$types';

/** Merchant validation: Apple → (Safari) → us → Apple gateway over mutual TLS. */
export const POST: RequestHandler = async ({ request }) => {
	// adapter-cloudflare v8 doesn't pass `platform`; bindings come from cloudflare:workers.
	if (!env.APPLE_PAY_CERT) error(500, 'APPLE_PAY_CERT mTLS binding is not configured');

	const { validationURL } = (await request.json().catch(() => ({}))) as { validationURL?: unknown };
	if (!isAppleGatewayUrl(validationURL)) error(400, 'validationURL is not an Apple Pay gateway');

	const res = await env.APPLE_PAY_CERT.fetch(validationURL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			merchantIdentifier: env.APPLE_PAY_MERCHANT_ID,
			displayName: env.APPLE_PAY_DISPLAY_NAME,
			initiative: 'web',
			initiativeContext: env.APPLE_PAY_DOMAIN
		})
	});

	if (!res.ok) {
		const detail = await res.text();
		console.error('Apple merchant validation failed', res.status, detail);
		error(502, `Apple merchant validation failed (${res.status}): ${detail.slice(0, 300)}`);
	}

	// Opaque merchant session — passed straight to session.completeMerchantValidation().
	return json(await res.json());
};
