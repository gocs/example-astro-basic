import { faroe } from "@lib/faroe";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { FaroeError } from "@faroe/sdk";
import { setUserAsEmailVerified } from "@lib/user";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	if (context.locals.session === null || context.locals.user === null) {
		return new Response("Not authenticated.", { status: 400 });
	}
	if (context.locals.user.emailVerified) {
		return new Response("Not allowed.", {
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
		await faroe.verifyUserEmail(context.locals.user.faroeId, code);
	} catch (e) {
		if (e instanceof FaroeError && e.code === "NOT_ALLOWED") {
			const verificationRequest = await faroe.createUserEmailVerificationRequest(context.locals.user.faroeId);
			console.log(`To ${context.locals.user.email}: Your code is ${verificationRequest.code}`);
			return new Response("Your verification code was expired. We sent a new one to your inbox.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "INCORRECT_CODE") {
			return new Response("Incorrect code.", {
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

	setUserAsEmailVerified(context.locals.user.id);

	return new Response(null, { status: 204 });
}
