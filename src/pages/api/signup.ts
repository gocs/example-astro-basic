import { ObjectParser } from "@pilcrowjs/object-parser";
import { verifyEmailInput, verifyPasswordInput, FaroeError } from "@faroe/sdk";
import { faroe } from "@lib/faroe";
import { createUser } from "@lib/user";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@lib/session";

import type { APIContext } from "astro";
import type { FaroeUser } from "@faroe/sdk";
import type { User } from "@lib/user";

export async function POST(context: APIContext): Promise<Response> {
	const data: unknown = await context.request.json();
	const parser = new ObjectParser(data);

	let username: string;
	let email: string;
	let password: string;
	try {
		username = parser.getString("username");
		email = parser.getString("email");
		password = parser.getString("password");
	} catch {
		return new Response("Invalid request body.", {
			status: 400
		});
	}

	if (username.length < 3 || username.length >= 32 || !/[A-Za-z0-9]/.test(username)) {
		return new Response("Please enter a valid username.", {
			status: 400
		});
	}
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

	let faroeUser: FaroeUser;
	try {
		faroeUser = await faroe.createUser(email, password, "0.0.0.0");
	} catch (e) {
		if (e instanceof FaroeError && e.code === "EMAIL_ALREADY_USED") {
			return new Response("Email is already used.", {
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

	let user: User;
	try {
		user = createUser(faroeUser.id, email, username);
	} catch {
		await faroe.deleteUser(faroeUser.id);
		return new Response("An unknown error occurred. Please try again later.", {
			status: 500
		});
	}

	const verificationRequest = await faroe.createUserEmailVerificationRequest(user.faroeId);
	console.log(`To ${user.email}: Your code is ${verificationRequest.code}`);

	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, user.id, null);

	setSessionTokenCookie(context, sessionToken, session.expiresAt);
	return new Response(null, { status: 204 });
}
