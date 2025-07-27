import { jsonSchema, tool } from "ai";
import { fetchWeather } from "../lib/weather";
import { convertCurrency, fetchCurrencyRates } from "./currency";

const weatherToolSchema = jsonSchema<{
	name: string;
}>({
	type: "object",
	properties: {
		name: {
			type: "string",
		},
	},
	required: ["name"],
});

const weatherTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Get the current weather in a location. Also today's astronomy for that place, like sunset and sunrise. Search by place name, city, or country.",
		parameters: weatherToolSchema,
		execute: async ({ name }) => {
			console.log("execute weather tool");
			try {
				const w = await fetchWeather(name, env);
				return {
					name: w.location?.name,
					country: w.location?.country,
					units: w.request?.unit === "m" ? "Celsius" : "Fahrenheit",
					temperature: w.current?.temperature,
					description: w.current?.weather_descriptions?.join(","),
					astro: w.current?.astro,
					uvIndex: w.current?.uv_index,
				};
			} catch (err) {
				console.error("Weather tool error:", err);
				// tell the AI that there was an error fetching the weather
				return {
					error: `Sorry, I couldn't fetch the weather for "${name}". Please check the location name and try again later.`,
				};
			}
		},
	});

const currencyToolSchema = jsonSchema<{
	from: string;
	to: string;
	amount?: number;
}>({
	type: "object",
	properties: {
		from: { type: "string" },
		to: { type: "string" },
		amount: { type: "number", default: 1 },
	},
	required: ["from", "to"],
});

const currencyTool = (env: CloudflareBindings) =>
	tool({
		description:
			"Convert an amount from one currency to another using the latest exchange rates (base EUR).",
		parameters: currencyToolSchema,
		execute: async ({ from, to, amount = 1 }) => {
			try {
				const data = await fetchCurrencyRates(env);
				const { result, rate } = convertCurrency(data.rates, from, to, amount);
				return {
					from,
					to,
					amount,
					result,
					rate,
					date: data.date,
				};
			} catch (err) {
				console.error("Currency tool error:", err);
				return {
					error: `Sorry, I couldn't fetch the currency rates right now. Please try again later.`,
				};
			}
		},
	});

export const getTools = (env: CloudflareBindings) => ({
	weather: weatherTool(env),
	currency: currencyTool(env),
	// Add other tools here as needed
});
