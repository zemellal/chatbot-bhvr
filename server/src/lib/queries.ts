import * as schema from "@server/db/schema";

import { queries } from "@server/db/schema";
import { drizzle } from "drizzle-orm/d1";
import type { QueryType } from "./constants";

export async function createQuery({
	prompt,
	expectedTools,
	type,
	env,
}: {
	prompt: string;
	expectedTools: string[];
	type: QueryType;
	env: CloudflareBindings;
}) {
	const db = drizzle(env.DB);
	const id = crypto.randomUUID();
	await db.insert(queries).values({
		id,
		prompt,
		expectedTools,
		type,
	});
	return { id, prompt, expectedTools, type };
}

export async function getAllQueries(env: CloudflareBindings) {
	const db = drizzle(env.DB);
	const allQueries = await db.select().from(queries).all();
	return allQueries;
}

export async function getQueryById(queryId: string, env: CloudflareBindings) {
	const db = drizzle(env.DB, { schema });
	const query = await db.query.queries.findFirst({
		where: (queries, { eq }) => eq(queries.id, queryId),
	});
	return query;
}
