import { hcWithType } from "server/dist/client";
import "./App.css";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AI_MAX_STEPS } from "shared";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8787";

const client = hcWithType(SERVER_URL);

function App() {
	// Fetch models
	const { data: modelsData } = useQuery({
		queryKey: ["models"],
		queryFn: async () => {
			const res = await client.models.$get();
			if (!res.ok) throw new Error("Failed to fetch models");
			const data = await res.json();
			return data.data;
		},
		staleTime: 1000 * 60 * 10, // cache for 10 mins
	});

	const [selectedModel, setSelectedModel] = useState<string | undefined>(
		undefined,
	);

	// Compose chat endpoint with model query param if selected
	const chatApiUrl = selectedModel
		? client.chat.$url({ query: { model: selectedModel } }).toString()
		: client.chat.$url().toString();

	const {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		error,
		reload,
		stop,
		status,
	} = useChat({ api: chatApiUrl, maxSteps: AI_MAX_STEPS });

	const chatHistoryRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: This is a valid use case for scrolling the chat history.
	useEffect(() => {
		const chatHistory = chatHistoryRef.current;
		if (chatHistory) {
			chatHistory.scrollTo({
				top: chatHistory.scrollHeight,
				behavior: "smooth",
			});
		}
	}, [messages]);

	return (
		<>
			<h1>Chatbot 🤖 meets Hono 🔥</h1>

			<div className="chatbot-container">
				<div className="chat-history" ref={chatHistoryRef}>
					{messages.map((msg) => (
						<div
							key={msg.id}
							className={`chat-message ${msg.role === "user" ? "user" : "bot"}`}
						>
							<span className={`${msg.role === "user" ? "chat-bubble" : ""}`}>
								{msg.content}
							</span>
						</div>
					))}
				</div>
				<form
					className="chat-input-form button-container"
					onSubmit={handleSubmit}
				>
					<input
						className="chat-input"
						value={input}
						onChange={handleInputChange}
						placeholder="Type your message..."
					/>
					<button
						className="chat-send-btn"
						type="submit"
						disabled={status !== "ready"}
					>
						Send
					</button>
				</form>
			</div>

			{modelsData && (
				<div className="label-group">
					<label htmlFor="model-select">Model:</label>
					<select
						id="model-select"
						value={selectedModel}
						onChange={(e) => setSelectedModel(e.target.value)}
					>
						{modelsData.providers.map((provider) =>
							modelsData.models[provider].map((model) => (
								<option key={model} value={model}>
									{provider}: {model}
								</option>
							)),
						)}
					</select>
				</div>
			)}

			{status === "streaming" && (
				<div>
					<div>{status}</div>
					<button type="button" onClick={() => stop()}>
						Stop
					</button>
				</div>
			)}
			{error && (
				<div>
					<div>An error occurred.</div>
					<button type="button" onClick={() => reload()}>
						Retry
					</button>
				</div>
			)}
		</>
	);
}

export default App;
