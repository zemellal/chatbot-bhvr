import { streamText as streamTextAi } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { getModel } from "./lib/aiProvider";
import { fetchWeather } from "./lib/weather";

export const app = new Hono<{ Bindings: CloudflareBindings }>()

	.use(cors())

	.get("/", (c) => {
		return c.text("Hello Hono!");
	})

	.post("/chat", async (c) => {
		try {
			const { messages } = await c.req.json();

			if (!messages) {
				return c.json(
					{ success: false, error: "Missing 'messages' in request body." },
					{ status: 400 },
				);
			}

			const model = getModel("ollama", c.env);

			const result = streamTextAi({
				model,
				messages,
			});

			// Mark the response as a v1 data stream:
			c.header("X-Vercel-AI-Data-Stream", "v1");
			c.header("Content-Type", "text/plain; charset=utf-8");
			c.header("Content-Encoding", "Identity");

			return stream(c, (stream) => stream.pipe(result.toDataStream()));
			// return result.toDataStreamResponse();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	})

	.get("/tools/weather", async (c) => {
		const query = c.req.query("query");
		if (!query) {
			const error = {
				success: false,
				error: "Missing 'query' parameter.",
			};
			return c.json(error, { status: 400 });
		}
		try {
			const weather = await fetchWeather(query, c.env.WEATHERSTACK_API_KEY);
			const response = {
				message: weather.request?.query
					? `Weather for ${weather.request.query}`
					: "Weather data",
				data: weather,
				success: true,
			};
			return c.json(response, { status: 200 });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	});

export default app;
