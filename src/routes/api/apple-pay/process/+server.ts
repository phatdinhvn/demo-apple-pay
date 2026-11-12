import { env } from 'cloudflare:workers';
import { error, json } from '@sveltejs/kit';
import { decryptPaymentData, type ApplePayPaymentData } from '#lib/server/applepay/decrypt.ts';
import type { ProcessResult } from '#lib/types.ts';
import type { RequestHandler } from './$types';

/**
 * Receives the Apple Pay token and decrypts it, as a payment processor would.
 * No card is charged. Sensitive fields (DPAN, cryptogram) are never logged or returned.
 */
export const POST: RequestHandler = async ({ request }) => {
	// adapter-cloudflare v8 doesn't pass `platform`; bindings come from cloudflare:workers.
	if (!env.APPLE_PAY_PPC_PRIVATE_KEY) error(500, 'APPLE_PAY_PPC_PRIVATE_KEY secret is not set');

	const body = (await request.json().catch(() => null)) as {
		token?: { paymentData?: ApplePayPaymentData; paymentMethod?: ApplePayJS.ApplePayPaymentMethod };
	} | null;
	const paymentData = body?.token?.paymentData;
	if (!paymentData?.data || !paymentData.header?.ephemeralPublicKey) {
		error(400, 'Missing or malformed payment token');
	}

	let decrypted;
	try {
		decrypted = await decryptPaymentData(
			paymentData,
			env.APPLE_PAY_PPC_PRIVATE_KEY,
			env.APPLE_PAY_MERCHANT_ID
		);
	} catch (e) {
		console.error('Token decryption failed:', (e as Error).message);
		error(422, `Could not decrypt token: ${(e as Error).message}`);
	}

	const exp = decrypted.applicationExpirationDate; // YYMMDD
	const result: ProcessResult = {
		transactionId: paymentData.header.transactionId,
		network: body?.token?.paymentMethod?.network,
		cardDisplayName: body?.token?.paymentMethod?.displayName,
		dpanLast4: decrypted.applicationPrimaryAccountNumber.slice(-4),
		expiry: `${exp.slice(2, 4)}/${exp.slice(0, 2)}`,
		amount: decrypted.transactionAmount,
		currencyCode: decrypted.currencyCode,
		paymentDataType: decrypted.paymentDataType,
		eciIndicator: decrypted.paymentData?.eciIndicator,
		hasCryptogram: Boolean(decrypted.paymentData?.onlinePaymentCryptogram)
	};
	return json(result);
};
