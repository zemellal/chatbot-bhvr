import { createGroq } from "@ai-sdk/groq";
import { ollama } from "ollama-ai-provider";

export type Provider = "groq" | "ollama";

export function getModel(provider: Provider, env: CloudflareBindings) {
	switch (provider) {
		case "groq": {
			if (!env.GROQ_API_KEY) {
				throw new Error("Missing GROQ_API_KEY in environment");
			}
			const groq = createGroq({ apiKey: env.GROQ_API_KEY });
			return groq("llama-3.1-8b-instant");
		}
		default:
			return ollama("deepseek-coder-v2");
	}
}
