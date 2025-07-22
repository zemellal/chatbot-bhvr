import { jsonSchema } from "ai";

export const weatherToolSchema = jsonSchema<{
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
