import { deleteSessionTokenCookie, invalidateSession } from "@lib/session";

import type { APIContext } from "astro";

export async function POST(context: APIContext) {
	if (context.locals.session === null) {
		return new Response(null, {
			status: 401
		});
	}
	invalidateSession(context.locals.session.id);
	deleteSessionTokenCookie(context);
	return new Response(null, {
		status: 204
	});
}
