import { ObjectParser } from "@pilcrowjs/object-parser";
import { verifyPasswordInput, FaroeError } from "@lib/sdk";
import { faroe } from "@lib/faroe";
import { setUserAsEmailVerified } from "@lib/user";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@lib/session";
import {
	deletePasswordResetSessionTokenCookie,
	invalidatePasswordResetSession,
	validatePasswordResetSessionRequest
} from "@lib/password-reset-session";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	const { session: passwordResetSession, user } = validatePasswordResetSessionRequest(context);

	if (passwordResetSession === null) {
		return new Response("Not authenticated.", { status: 400 });
	}
	if (!passwordResetSession.emailVerified) {
		return new Response("Not allowed", {
			status: 403
		});
	}

	const data: unknown = await context.request.json();
	const parser = new ObjectParser(data);

	let password: string;
	try {
		password = parser.getString("password");
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

	try {
		await faroe.resetUserPassword(passwordResetSession.faroeRequestId, password, "0.0.0.0");
	} catch (e) {
		if (e instanceof FaroeError && e.code === "INVALID_REQUEST_ID") {
			return new Response("Please restart the process.", {
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
				status: 429
			});
		}
		return new Response("An unknown error occurred. Please try again.", {
			status: 500
		});
	}

	setUserAsEmailVerified(user.id);
	invalidatePasswordResetSession(passwordResetSession.id);
	deletePasswordResetSessionTokenCookie(context);

	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, user.id, null);
	setSessionTokenCookie(context, sessionToken, session.expiresAt);
	return new Response(null, { status: 204 });
}
