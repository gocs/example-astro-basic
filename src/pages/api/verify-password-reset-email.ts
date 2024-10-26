import { faroe } from "@lib/faroe";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { FaroeError } from "@lib/sdk";
import {
	deletePasswordResetSessionTokenCookie,
	invalidatePasswordResetSession,
	setPasswordResetSessionAsEmailVerified,
	validatePasswordResetSessionRequest
} from "@lib/password-reset-session";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	const { session } = validatePasswordResetSessionRequest(context);
	if (session === null) {
		return new Response("Not authenticated.", { status: 400 });
	}
	if (session.emailVerified) {
		return new Response("Not allowed", {
			status: 403
		});
	}

	const data: unknown = await context.request.json();
	const parser = new ObjectParser(data);

	let code: string;
	try {
		code = parser.getString("code");
	} catch {
		return new Response("Invalid request body.", {
			status: 400
		});
	}

	if (code.length !== 8) {
		return new Response("Please enter your verification code.", {
			status: 400
		});
	}

	try {
		await faroe.verifyPasswordResetRequestEmail(session.faroeRequestId, code, "0.0.0.0");
	} catch (e) {
		if (e instanceof FaroeError && e.code === "NOT_FOUND") {
			invalidatePasswordResetSession(session.id);
			deletePasswordResetSessionTokenCookie(context);
			return new Response("Please restart the process.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "INCORRECT_CODE") {
			return new Response("Incorrect code.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "TOO_MANY_REQUESTS") {
			return new Response("Please restart the process.", {
				status: 400
			});
		}
		return new Response("An unknown error occurred. Please try again later.", {
			status: 500
		});
	}

	setPasswordResetSessionAsEmailVerified(session.id);

	return new Response(null, { status: 204 });
}
