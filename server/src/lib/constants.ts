export const QUERY_TYPES = [
	"simple",
	"complex",
	"verbose",
	"obvious",
	"ambiguous",
	// Add more as needed
] as const;

export type QueryType = (typeof QUERY_TYPES)[number];
