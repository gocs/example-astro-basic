import { verifyEmailInput, FaroeError } from "@lib/sdk";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { faroe } from "@lib/faroe";
import { createPasswordResetSession, setPasswordResetSessionTokenCookie } from "@lib/password-reset-session";
import { generateSessionToken } from "@lib/session";
import { getUserFromFaroeId } from "@lib/user";

import type { APIContext } from "astro";
import type { FaroePasswordResetRequest } from "@lib/sdk";

export async function POST(context: APIContext): Promise<Response> {
	const data = await context.request.json();
	const parser = new ObjectParser(data);

	let email: string;
	try {
		email = parser.getString("email");
	} catch {
		return new Response("Invalid request body.", {
			status: 400
		});
	}

	if (!verifyEmailInput(email)) {
		return new Response("Please enter a valid email address.");
	}

	let resetRequest: FaroePasswordResetRequest;
	let verificationCode: string;
	try {
		[resetRequest, verificationCode] = await faroe.createPasswordResetRequest(email, "0.0.0.0");
	} catch (e) {
		if (e instanceof FaroeError && e.code === "USER_NOT_EXISTS") {
			return new Response("Account does not exist.", {
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

	const user = getUserFromFaroeId(resetRequest.userId);
	if (user === null) {
		await faroe.deleteUser(resetRequest.userId);
		return new Response("Account does not exist.", {
			status: 400
		});
	}

	const sessionToken = generateSessionToken();
	const session = createPasswordResetSession(sessionToken, user.id, resetRequest.id);

	console.log(`To ${email}: Your code is ${verificationCode}`);

	setPasswordResetSessionTokenCookie(context, sessionToken, session.expiresAt);

	return new Response(null, { status: 204 });
}
