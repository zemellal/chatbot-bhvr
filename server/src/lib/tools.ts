import { jsonSchema, tool } from "ai";
import { fetchWeather } from "../lib/weather";

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
			"Get the current weather in a location. The parameter is called 'name'.",
		parameters: weatherToolSchema,
		execute: async ({ name }) => {
			console.log("execute weather tool");
			const w = await fetchWeather(name, env);
			return {
				name: w.location?.name,
				country: w.location?.country,
				units: w.request?.unit === "m" ? "Celsius" : "Fahrenheit",
				temperature: w.current?.temperature,
				description: w.current?.weather_descriptions?.join(","),
			};
		},
	});

export const getTools = (env: CloudflareBindings) => ({
	weather: weatherTool(env),
	// Add other tools here as needed
});
