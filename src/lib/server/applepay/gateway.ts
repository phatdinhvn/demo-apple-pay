/**
 * Hosts Apple may hand us as `validationURL` in `onvalidatemerchant`.
 * https://developer.apple.com/documentation/applepayontheweb/setting-up-your-server
 * Anything else is rejected so the endpoint cannot be used as an mTLS proxy.
 */
const APPLE_GATEWAY_HOST = /^(cn-)?apple-pay-gateway(-(nc|pr|sh|tj)-pod\d+|-cert)?\.apple\.com$/;

export function isAppleGatewayUrl(raw: unknown): raw is string {
	if (typeof raw !== 'string') return false;
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' && APPLE_GATEWAY_HOST.test(url.hostname);
	} catch {
		return false;
	}
}
