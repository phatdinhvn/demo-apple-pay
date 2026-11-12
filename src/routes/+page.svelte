<script lang="ts">
	import { onMount } from 'svelte';
	import { isApplePayAvailable, startApplePay, type StepStatus } from '#lib/applepay.ts';
	import type { ProcessResult } from '#lib/types.ts';

	const product = {
		name: 'Aurora Ceramic Mug',
		description: 'Hand-glazed, 350 ml. A tiny purchase to try Apple Pay on the web.',
		price: '1.00'
	};
	const shipping = '0.00';
	const total = (Number(product.price) + Number(shipping)).toFixed(2);

	const CURRENCIES: Record<string, string> = { '840': 'USD', '978': 'EUR', '704': 'VND' };

	type Step = { id: string; label: string; status: StepStatus; detail?: string };

	let available = $state<boolean | null>(null);
	let busy = $state(false);
	let steps = $state<Step[]>([]);
	let result = $state<ProcessResult | null>(null);
	let errorMessage = $state<string | null>(null);
	let cancelled = $state(false);

	onMount(() => {
		available = isApplePayAvailable();
	});

	function onStep(id: string, label: string, status: StepStatus, detail?: string) {
		const existing = steps.find((s) => s.id === id);
		if (existing) Object.assign(existing, { label, status, detail });
		else steps.push({ id, label, status, detail });
	}

	function pay() {
		if (busy) return;
		busy = true;
		steps = [];
		result = null;
		errorMessage = null;
		cancelled = false;

		// Must stay synchronous up to `new ApplePaySession` (user-gesture requirement).
		startApplePay(
			{
				countryCode: 'US',
				currencyCode: 'USD',
				supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
				merchantCapabilities: ['supports3DS'],
				lineItems: [
					{ label: product.name, amount: product.price },
					{ label: 'Shipping', amount: shipping }
				],
				total: { label: 'Apple Pay Demo', amount: total }
			},
			onStep
		)
			.then((r) => {
				result = r;
				if (!r) {
					cancelled = true;
					steps = steps.filter((s) => s.status !== 'active');
				}
			})
			.catch((err: Error) => (errorMessage = err.message))
			.finally(() => (busy = false));
	}

	function formatAmount(minor: number, numericCode: string) {
		const code = CURRENCIES[numericCode] ?? 'USD';
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(
			minor / 100
		);
	}
</script>

<svelte:head>
	<title>Apple Pay Demo</title>
	<script
		src="https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js"
		crossorigin="anonymous"
	></script>
</svelte:head>

<main
	class="min-h-dvh bg-neutral-100 px-4 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
>
	<div class="mx-auto flex max-w-md flex-col gap-6">
		<header class="flex items-center justify-between">
			<h1 class="text-lg font-semibold tracking-tight">Apple Pay Demo</h1>
			<span
				class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
			>
				Sandbox · no real charge
			</span>
		</header>

		<section
			class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
		>
			<div
				class="grid aspect-[4/3] place-items-center bg-gradient-to-br from-sky-200 via-indigo-200 to-fuchsia-200 dark:from-sky-900 dark:via-indigo-900 dark:to-fuchsia-900"
			>
				<svg
					viewBox="0 0 64 64"
					class="h-28 w-28 text-white/90 drop-shadow"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					aria-hidden="true"
				>
					<path
						d="M12 18h32v24a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V18Z"
						fill="currentColor"
						fill-opacity=".35"
					/>
					<path d="M44 24h4a6 6 0 0 1 0 12h-4" />
					<path d="M22 8c0 3 3 3 3 6M30 8c0 3 3 3 3 6" stroke-linecap="round" />
				</svg>
			</div>

			<div class="flex flex-col gap-5 p-5">
				<div>
					<h2 class="text-xl font-semibold">{product.name}</h2>
					<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{product.description}</p>
				</div>

				<dl class="space-y-1.5 text-sm">
					<div class="flex justify-between">
						<dt class="text-neutral-600 dark:text-neutral-400">Subtotal</dt>
						<dd>${product.price}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-neutral-600 dark:text-neutral-400">Shipping</dt>
						<dd>${shipping}</dd>
					</div>
					<div
						class="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold dark:border-neutral-800"
					>
						<dt>Total</dt>
						<dd>${total}</dd>
					</div>
				</dl>

				{#if available === null}
					<div class="h-12 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"></div>
				{:else if available}
					<apple-pay-button
						class="apple-pay"
						class:opacity-50={busy}
						buttonstyle="black"
						type="buy"
						locale="en-US"
						role="button"
						tabindex="0"
						aria-disabled={busy}
						onclick={pay}
						onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && pay()}
					></apple-pay-button>
				{:else}
					<p
						class="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
					>
						Apple Pay isn’t available in this browser. Open this page in <strong>Safari</strong> on an
						iPhone, iPad or Mac with Apple Pay set up.
					</p>
				{/if}
			</div>
		</section>

		{#if steps.length || errorMessage || cancelled}
			<section
				class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
			>
				<h3 class="mb-3 text-sm font-semibold text-neutral-500 uppercase">Flow</h3>
				<ol class="space-y-2.5 text-sm">
					{#each steps as step (step.id)}
						<li class="flex gap-2.5">
							<span
								class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] text-white
								{step.status === 'done'
									? 'bg-emerald-500'
									: step.status === 'error'
										? 'bg-red-500'
										: 'animate-pulse bg-sky-500'}"
							>
								{step.status === 'done' ? '✓' : step.status === 'error' ? '!' : ''}
							</span>
							<div class="min-w-0">
								<p>{step.label}</p>
								{#if step.detail}<p
										class="mt-0.5 text-xs break-words text-red-600 dark:text-red-400"
									>
										{step.detail}
									</p>{/if}
							</div>
						</li>
					{/each}
				</ol>
				{#if cancelled}<p class="mt-3 text-sm text-neutral-500">Payment cancelled.</p>{/if}
				{#if errorMessage && !steps.some((s) => s.status === 'error')}
					<p class="mt-3 text-sm break-words text-red-600 dark:text-red-400">{errorMessage}</p>
				{/if}
			</section>
		{/if}

		{#if result}
			<section
				class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
			>
				<h3 class="mb-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
					Payment token decrypted
				</h3>
				<p class="mb-4 text-xs text-neutral-500">
					This is what a payment processor receives. Sensitive fields are masked.
				</p>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					<dt class="text-neutral-500">Card</dt>
					<dd>{result.cardDisplayName ?? result.network ?? '—'}</dd>
					<dt class="text-neutral-500">Device PAN</dt>
					<dd class="font-mono">•••• {result.dpanLast4}</dd>
					<dt class="text-neutral-500">Expiry</dt>
					<dd class="font-mono">{result.expiry}</dd>
					<dt class="text-neutral-500">Amount</dt>
					<dd>{formatAmount(result.amount, result.currencyCode)}</dd>
					<dt class="text-neutral-500">Type</dt>
					<dd>
						{result.paymentDataType}{result.eciIndicator ? ` · ECI ${result.eciIndicator}` : ''}
					</dd>
					<dt class="text-neutral-500">Cryptogram</dt>
					<dd>{result.hasCryptogram ? 'Present' : 'Missing'}</dd>
					<dt class="text-neutral-500">Transaction</dt>
					<dd class="truncate font-mono text-xs leading-5" title={result.transactionId}>
						{result.transactionId}
					</dd>
				</dl>
			</section>
		{/if}

		<p class="text-center text-xs text-neutral-500">
			Merchant validation over mTLS · token decrypted with WebCrypto on Cloudflare Workers
		</p>
	</div>
</main>

<style>
	.apple-pay {
		display: block;
		--apple-pay-button-width: 100%;
		--apple-pay-button-height: 48px;
		--apple-pay-button-border-radius: 10px;
		--apple-pay-button-padding: 0;
		--apple-pay-button-box-sizing: border-box;
		cursor: pointer;
	}
</style>
