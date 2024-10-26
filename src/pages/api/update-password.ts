import { ObjectParser } from "@pilcrowjs/object-parser";
import { verifyPasswordInput, FaroeError } from "@faroe/sdk";
import { faroe } from "@lib/faroe";
import { createSession, generateSessionToken, invalidateUserSessions, setSessionTokenCookie } from "@lib/session";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	if (context.locals.user === null) {
		return new Response("Not authenticated.", {
			status: 400
		});
	}

	const data: unknown = await context.request.json();
	const parser = new ObjectParser(data);

	let password: string;
	let newPassword: string;
	try {
		password = parser.getString("password");
		newPassword = parser.getString("new_password");
	} catch {
		return new Response("Invalid request body.", {
			status: 400
		});
	}

	if (!verifyPasswordInput(password)) {
		return new Response("Please enter a valid password.", {
			status: 400
		});
	}
	if (!verifyPasswordInput(newPassword)) {
		return new Response("Please enter a valid password.", {
			status: 400
		});
	}

	try {
		await faroe.updateUserPassword(context.locals.user.faroeId, password, newPassword, "0.0.0.0");
	} catch (e) {
		if (e instanceof FaroeError && e.code === "INCORRECT_PASSWORD") {
			return new Response("Incorrect password.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "WEAK_PASSWORD") {
			return new Response("Please use a stronger password.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "TOO_MANY_REQUESTS") {
			return new Response("Please try again later.", {
				status: 400
			});
		}
		return new Response("An unknown error occurred. Please try again later.", {
			status: 500
		});
	}

	invalidateUserSessions(context.locals.user.id);

	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, context.locals.user.id, null);

	setSessionTokenCookie(context, sessionToken, session.expiresAt);
	return new Response(null, { status: 204 });
}
