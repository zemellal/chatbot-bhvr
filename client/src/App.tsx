import { hcWithType } from "server/dist/client";
import "./App.css";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8787";

const client = hcWithType(SERVER_URL);

function App() {
	const { messages, input, handleInputChange, handleSubmit, error, reload } =
		useChat({ api: client.chat.$url().toString() });

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
					<button className="chat-send-btn" type="submit">
						Send
					</button>
				</form>
			</div>

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
