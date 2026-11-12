/**
 * Decrypts an Apple Pay EC_v1 payment token using only WebCrypto (runs on Workers).
 * https://developer.apple.com/documentation/passkit/payment-token-format-reference
 *
 * DEMO SCOPE: the PKCS#7 `signature` is NOT verified here. A production system must
 * verify the signature chain to Apple Root CA - G3, check signing time, and only then
 * trust the decrypted data.
 */

export interface ApplePayPaymentData {
	version: string;
	data: string;
	signature: string;
	header: {
		ephemeralPublicKey: string;
		publicKeyHash: string;
		transactionId: string;
	};
}

export interface DecryptedToken {
	applicationPrimaryAccountNumber: string;
	applicationExpirationDate: string; // YYMMDD
	currencyCode: string; // ISO 4217 numeric
	transactionAmount: number; // minor units
	deviceManufacturerIdentifier: string;
	paymentDataType: string;
	paymentData: { onlinePaymentCryptogram?: string; eciIndicator?: string };
}

const P256 = { name: 'ECDH', namedCurve: 'P-256' } as const;
const enc = new TextEncoder();

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function bytesToB64(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
	return b64ToBytes(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
}

export async function decryptPaymentData(
	paymentData: ApplePayPaymentData,
	privateKeyPem: string,
	merchantId: string
): Promise<DecryptedToken> {
	if (paymentData.version !== 'EC_v1') {
		throw new Error(`Unsupported token version: ${paymentData.version}`);
	}

	const privateKey = await crypto.subtle.importKey('pkcs8', pemToDer(privateKeyPem), P256, true, [
		'deriveBits'
	]);

	// Sanity check: the token must be encrypted for *our* Payment Processing Certificate.
	const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', privateKey);
	const ourPublicKey = await crypto.subtle.importKey('jwk', { kty, crv, x, y }, P256, true, []);
	const ourSpki = await crypto.subtle.exportKey('spki', ourPublicKey);
	const ourKeyHash = bytesToB64(await crypto.subtle.digest('SHA-256', ourSpki));
	if (ourKeyHash !== paymentData.header.publicKeyHash) {
		throw new Error('Token was encrypted for a different Payment Processing Certificate');
	}

	// 1. ECDH shared secret with the ephemeral key Apple generated for this payment.
	const ephemeralKey = await crypto.subtle.importKey(
		'spki',
		b64ToBytes(paymentData.header.ephemeralPublicKey),
		P256,
		false,
		[]
	);
	const sharedSecret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeralKey }, privateKey, 256)
	);

	// 2. NIST SP 800-56A concat KDF (single round, SHA-256).
	//    partyV = SHA-256(merchant identifier) — the same value stored in the
	//    certificate's 1.2.840.113635.100.6.32 extension.
	const algorithmId = concat(new Uint8Array([0x0d]), enc.encode('id-aes256-GCM'));
	const partyU = enc.encode('Apple');
	const partyV = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(merchantId)));
	const counter = new Uint8Array([0, 0, 0, 1]);
	const keyMaterial = await crypto.subtle.digest(
		'SHA-256',
		concat(counter, sharedSecret, algorithmId, partyU, partyV)
	);

	// 3. AES-256-GCM, 16-byte zero IV. `data` is ciphertext || 16-byte tag.
	const aesKey = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['decrypt']);
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: new Uint8Array(16), tagLength: 128 },
		aesKey,
		b64ToBytes(paymentData.data)
	);

	return JSON.parse(new TextDecoder().decode(plaintext)) as DecryptedToken;
}
