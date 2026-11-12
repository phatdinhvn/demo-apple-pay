import type { ProcessResult } from '#lib/types.ts';

export type StepStatus = 'active' | 'done' | 'error';
export type OnStep = (id: string, label: string, status: StepStatus, detail?: string) => void;

const API_VERSION = 3;

/** True when this browser/device can show the Apple Pay sheet (Safari on Apple hardware). */
export function isApplePayAvailable(): boolean {
	try {
		return typeof ApplePaySession !== 'undefined' && ApplePaySession.canMakePayments();
	} catch {
		// Throws on insecure origins.
		return false;
	}
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const text = await res.text();
		let message = text;
		try {
			message = JSON.parse(text).message ?? text;
		} catch {
			/* plain text */
		}
		throw new Error(`${res.status}: ${message}`);
	}
	return res.json() as Promise<T>;
}

/**
 * Opens the Apple Pay sheet. MUST be called synchronously from a user gesture (click),
 * because `new ApplePaySession()` is rejected outside one.
 * Resolves with the decrypted (masked) result, or null if the user cancelled.
 */
export function startApplePay(
	request: ApplePayJS.ApplePayPaymentRequest,
	onStep: OnStep
): Promise<ProcessResult | null> {
	return new Promise((resolve, reject) => {
		const session = new ApplePaySession(API_VERSION, request);
		let settled = false;
		const fail = (err: unknown) => {
			if (settled) return;
			settled = true;
			reject(err instanceof Error ? err : new Error(String(err)));
		};

		session.onvalidatemerchant = async (event) => {
			onStep('validate', 'Validating merchant with Apple', 'active');
			try {
				const merchantSession = await postJson('/api/apple-pay/validate', {
					validationURL: event.validationURL
				});
				session.completeMerchantValidation(merchantSession);
				onStep('validate', 'Merchant validated', 'done');
				onStep('authorize', 'Waiting for Face ID / Touch ID', 'active');
			} catch (err) {
				onStep('validate', 'Merchant validation failed', 'error', (err as Error).message);
				session.abort();
				fail(err);
			}
		};

		session.onpaymentauthorized = async (event) => {
			onStep('authorize', 'Payment authorized on device', 'done');
			onStep('decrypt', 'Decrypting payment token on server', 'active');
			try {
				const result = await postJson<ProcessResult>('/api/apple-pay/process', {
					token: event.payment.token
				});
				session.completePayment({ status: ApplePaySession.STATUS_SUCCESS });
				onStep('decrypt', 'Token decrypted', 'done');
				settled = true;
				resolve(result);
			} catch (err) {
				session.completePayment({ status: ApplePaySession.STATUS_FAILURE });
				onStep('decrypt', 'Token processing failed', 'error', (err as Error).message);
				fail(err);
			}
		};

		session.oncancel = () => {
			if (settled) return;
			settled = true;
			resolve(null);
		};

		onStep('sheet', 'Payment sheet opened', 'done');
		session.begin();
	});
}
