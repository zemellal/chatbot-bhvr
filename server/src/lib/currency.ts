export interface FixerResponse {
	success: boolean;
	timestamp: number;
	base: string;
	date: string;
	rates: Record<string, number>;
}

export async function fetchCurrencyRates(env: CloudflareBindings) {
	const kv = env.CHATBOT_TOOL_KV;
	const apiKey = env.FIXER_API_KEY;

	// Try to get the last known base from cache (optional, or just default to EUR)
	const defaultBase = "EUR";
	const cacheKey = `currency:latest:${defaultBase}`;
	const cached = await kv.get(cacheKey, { type: "json" });

	if (cached) {
		console.log("returning cached currency data from KV...");
		return cached as FixerResponse;
	}

	if (!apiKey) {
		throw new Error(
			"Fixer API key is missing. Please set FIXER_API_KEY in your environment.",
		);
	}

	console.log("fetching external currency api...");
	const url = `http://data.fixer.io/api/latest?access_key=${apiKey}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Currency API error: [${res.status}] ${res.statusText}`);
	}

	const data: FixerResponse = await res.json();
	const base = data.base || defaultBase;
	const newCacheKey = `currency:latest:${base}`;
	if (cacheKey !== newCacheKey) console.log("Fixer API base currency changed!");
	await kv.put(newCacheKey, JSON.stringify(data), {
		expirationTtl: 6 * 60 * 60,
	});
	return data;
}

/**
 * Converts an amount from one currency to another using EUR as the base.
 * @param rates - The rates object from Fixer API (base: EUR)
 * @param from - The currency code to convert from
 * @param to - The currency code to convert to
 * @param amount - The amount to convert (default 1)
 * @returns The converted amount and the effective rate
 */
export function convertCurrency(
	rates: Record<string, number>,
	from: string,
	to: string,
	amount: number = 1,
): { result: number; rate: number } {
	if (!rates[from] || !rates[to]) {
		throw new Error(`Unsupported currency code: ${!rates[from] ? from : to}`);
	}
	let result: number;
	let rate: number;
	if (from === "EUR") {
		rate = rates[to];
		result = amount * rate;
	} else if (to === "EUR") {
		rate = 1 / rates[from];
		result = amount * rate;
	} else {
		rate = rates[to] / rates[from];
		result = amount * rate;
	}
	return { result, rate };
}
