import {
	NodeApiError,
	type IDataObject,
	type IExecuteFunctions,
	type JsonObject,
} from 'n8n-workflow';

/** "https://app.orvantahq.io/" → "https://app.orvantahq.io" */
export const baseUrlOf = (url: string) => String(url || '').trim().replace(/\/+$/, '');

/** 18400.5 → 1840050; 0, empty or invalid → undefined (no amount). */
export const toCents = (amount: unknown): number | undefined => {
	const n = Number(amount);
	return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
};

/** Calls Orvanta with the credential's key. Orvanta's errors are plain sentences: show them as is. */
export async function callOrvanta(
	ctx: IExecuteFunctions,
	baseUrl: string,
	path: string,
	body: IDataObject,
): Promise<IDataObject> {
	try {
		return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'orvantaApi', {
			method: 'POST',
			url: `${baseUrl}${path}`,
			body,
			json: true,
		})) as IDataObject;
	} catch (error) {
		const e = error as JsonObject & { response?: { body?: { error?: string } } };
		const message = e.response?.body?.error;
		throw new NodeApiError(ctx.getNode(), e, message ? { message: `Orvanta: ${message}` } : undefined);
	}
}

export const askOrvanta = (ctx: IExecuteFunctions, baseUrl: string, body: IDataObject) =>
	callOrvanta(ctx, baseUrl, '/api/v1/check', body);
