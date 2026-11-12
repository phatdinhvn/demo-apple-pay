/** Masked result returned by /api/apple-pay/process. */
export interface ProcessResult {
	transactionId: string;
	network?: string;
	cardDisplayName?: string;
	dpanLast4: string;
	expiry: string; // MM/YY
	amount: number; // minor units
	currencyCode: string; // ISO 4217 numeric
	paymentDataType: string;
	eciIndicator?: string;
	hasCryptogram: boolean;
}
