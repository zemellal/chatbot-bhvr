import { generateText, streamText as streamTextAi } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { AI_MAX_STEPS } from "shared/dist";
import { getModel } from "./lib/aiProvider";
import { getTools } from "./lib/tools";
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

			const model = getModel("groq", c.env);
			const tools = getTools(c.env);

			const result = streamTextAi({
				model,
				messages,
				tools,
				// onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
				// 	console.log("Step finished:", {
				// 		text,
				// 		toolCalls,
				// 		toolResults,
				// 		finishReason,
				// 		usage,
				// 	});
				// 	// your own logic, e.g. for saving the chat history or recording usage
				// },
				onFinish(params) {
					console.log("On Finish:", params);
				},
				maxSteps: AI_MAX_STEPS,
				// toolCallStreaming: true,
				// onError(err) {},
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

	.post("/ai-tool-test", async (c) => {
		const prompt = c.req.query("prompt");
		try {
			const model = getModel("groq", c.env);
			const tools = getTools(c.env);

			// type MyToolCall = ToolCallUnion<typeof myToolSet>;
			// type MyToolResult = ToolResultUnion<typeof myToolSet>;

			const result = await generateText({
				model: model,
				tools,
				maxSteps: AI_MAX_STEPS,
				prompt: prompt || "What is the weather in San Francisco?",
			});

			// const allToolCalls = result.steps.flatMap((step) => step.toolCalls);
			const allToolResults = result.steps.flatMap((step) => step.toolResults);
			const allToolUsage = result.steps.flatMap((step) => step.usage);

			return c.json(
				{
					success: true,
					message: result.text,
					data: {
						modelId: result.response.modelId,
						allToolResults,
						allToolUsage,
						response: result.response,
						steps: result.steps,
					},
				},
				{ status: 200 },
			);
		} catch (err) {
			console.error("Error in /ai-tool-test:", err);
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
			const weather = await fetchWeather(query, c.env);
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
