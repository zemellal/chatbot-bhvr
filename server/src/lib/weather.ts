// This file is part of the WeatherStack API integration for fetching current weather data.

export interface WeatherstackResponse {
	request?: {
		type?: string;
		query?: string;
		language?: string;
		unit?: string;
	};
	location?: {
		name?: string;
		country?: string;
		region?: string;
		lat?: string;
		lon?: string;
		timezone_id?: string;
		localtime?: string;
		localtime_epoch?: number;
		utc_offset?: string;
	};
	current?: {
		observation_time?: string;
		temperature?: number;
		weather_code?: number;
		weather_icons?: string[];
		weather_descriptions?: string[];
		astro?: {
			sunrise?: string;
			sunset?: string;
			moonrise?: string;
			moonset?: string;
			moon_phase?: string;
			moon_illumination?: number;
		};
		air_quality?: {
			co?: string;
			no2?: string;
			o3?: string;
			so2?: string;
			pm2_5?: string;
			pm10?: string;
			"us-epa-index"?: string;
			"gb-defra-index"?: string;
		};
		wind_speed?: number;
		wind_degree?: number;
		wind_dir?: string;
		pressure?: number;
		precip?: number;
		humidity?: number;
		cloudcover?: number;
		feelslike?: number;
		uv_index?: number;
		visibility?: number;
	};
}

/**
 * Fetches weather data from the WeatherStack API and caches it in Cloudflare KV.
 */
export async function fetchWeather(query: string, env: CloudflareBindings) {
	const kv = env.CHATBOT_TOOL_KV;
	const apiKey = env.WEATHERSTACK_API_KEY;
	const cacheKey = `weather:${query.toLowerCase().trim()}`;
	const cached = await kv.get(cacheKey, { type: "json" });

	if (cached) {
		console.log("returning cached weather data from KV...");
		return cached as WeatherstackResponse;
	}

	if (!apiKey) {
		throw new Error(
			"Weather API key is missing. Please set WEATHERSTACK_API_KEY in your environment.",
		);
	}

	console.log("fetching external weather api...");
	const url = `https://api.weatherstack.com/current?access_key=${apiKey}&query=${encodeURIComponent(query)}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Weather API error: [${res.status}] ${res.statusText}`);
	}

	const data = await res.json();
	await kv.put(cacheKey, JSON.stringify(data), { expirationTtl: 10 * 60 });
	return data as WeatherstackResponse;
}
