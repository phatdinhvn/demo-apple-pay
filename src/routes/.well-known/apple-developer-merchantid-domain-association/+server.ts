import association from '../../../../static/.well-known/apple-developer-merchantid-domain-association.txt?raw';
import type { RequestHandler } from './$types';

/**
 * Apple fetches this exact path (no extension) to verify the merchant domain.
 * Static files without an extension aren't served by the asset pipeline here,
 * so the Worker serves the downloaded file's contents from this route instead.
 */
export const GET: RequestHandler = () =>
	new Response(association, {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
