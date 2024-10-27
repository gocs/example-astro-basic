import { ObjectParser } from "@pilcrowjs/object-parser";
import { verifyEmailInput, verifyPasswordInput, FaroeError } from "@faroe/sdk";
import { faroe } from "@lib/faroe";
import { getUserFromEmail } from "@lib/user";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@lib/session";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	const data: unknown = await context.request.json();
	const parser = new ObjectParser(data);

	let email: string;
	let password: string;
	try {
		email = parser.getString("email");
		password = parser.getString("password");
	} catch (e) {
		return new Response("Invalid request body.", {
			status: 400
		});
	}
	email = email.toLowerCase();

	if (!verifyEmailInput(email)) {
		return new Response("Please enter a valid email address.", {
			status: 400
		});
	}
	if (!verifyPasswordInput(password)) {
		return new Response("Please enter a valid password.", {
			status: 400
		});
	}

	const user = getUserFromEmail(email);
	if (user === null) {
		return new Response("Account does not exist.", {
			status: 400
		});
	}

	try {
		await faroe.verifyUserPassword(user.faroeId, password, "0.0.0.0");
	} catch (e) {
		if (e instanceof FaroeError && e.code === "INCORRECT_PASSWORD") {
			return new Response("Incorrect password.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "TOO_MANY_REQUESTS") {
			return new Response("Please try again later.", {
				status: 400
			});
		}
		console.log(e);
		return new Response("An unknown error occurred. Please try again later.", {
			status: 500
		});
	}

	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, user.id, null);

	setSessionTokenCookie(context, sessionToken, session.expiresAt);
	return new Response(null, { status: 204 });
}
