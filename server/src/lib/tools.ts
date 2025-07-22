import { tool } from "ai";
import { fetchWeather } from "../lib/weather";
import { weatherToolSchema } from "./schemas";

export const weatherTool = (weatherApiKey: string) =>
	tool({
		description:
			"Get the current weather in a location. The parameter is called 'name'.",
		parameters: weatherToolSchema,
		execute: async ({ name }) => {
			console.log("execute weather tool");
			const weather = await fetchWeather(name, weatherApiKey);

			if (
				weather.current &&
				weather.current.temperature !== undefined &&
				weather.location &&
				weather.location.name
			) {
				return `The weather in ${weather.location.name} is ${weather.current.temperature}°${weather.request?.unit === "m" ? "C" : "F"} with ${weather.current.weather_descriptions?.[0]}.`;
			} else {
				return `Sorry, I couldn't fetch the weather for "${name}". Please check the location name and try again.`;
			}
		},
	});
