import { createGroq } from "@ai-sdk/groq";
import { getTools } from "./tools";

export const PROVIDERS = ["groq"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const MODELS = {
	groq: [
		"llama-3.3-70b-versatile",
		"qwen/qwen3-32b",
		"deepseek-r1-distill-llama-70b",
	] as const,
	// ollama: ["deepseek-coder-v2"] as const,
};
export type ModelForProvider<P extends Provider> = (typeof MODELS)[P][number];

export function isValidProvider(provider: string): provider is Provider {
	return PROVIDERS.includes(provider as Provider);
}

export function isValidModel<P extends Provider>(
	provider: P,
	model: string,
): model is ModelForProvider<P> {
	return (MODELS[provider] as readonly string[]).includes(model);
}

export function getModel<P extends Provider>(
	provider: P,
	model: string,
	env: CloudflareBindings,
) {
	if (!isValidModel(provider, model)) {
		throw new Error(`Invalid model "${model}" for provider "${provider}"`);
	}
	switch (provider) {
		// case "ollama":
		// 	return ollama(model as ModelForProvider<"ollama">);
		default: {
			if (!env.GROQ_API_KEY) {
				throw new Error("Missing GROQ_API_KEY in environment");
			}
			const groq = createGroq({ apiKey: env.GROQ_API_KEY });
			return groq(model as ModelForProvider<"groq">);
		}
	}
}

export function getValidatedModelAndTools({
	provider,
	model,
	env,
}: {
	provider?: string;
	model?: string;
	env: CloudflareBindings;
}) {
	const resolvedProvider = provider || PROVIDERS[0];
	const resolvedModel = model || MODELS.groq[0];

	if (!isValidProvider(resolvedProvider)) {
		return {
			error: { success: false, error: "Invalid provider" },
			status: 400,
		};
	}
	if (!isValidModel(resolvedProvider, resolvedModel)) {
		return {
			error: { success: false, error: "Invalid model for provider" },
			status: 400,
		};
	}
	const modelInstance = getModel(resolvedProvider, resolvedModel, env);
	const tools = getTools(env);
	return {
		modelInstance,
		tools,
		provider: resolvedProvider,
		model: resolvedModel,
	};
}
