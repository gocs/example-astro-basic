import { FaroeError } from "@faroe/sdk";
import { faroe } from "@lib/faroe";

import type { APIContext } from "astro";
import type { FaroeUserEmailVerificationRequest } from "@faroe/sdk";

export async function POST(context: APIContext): Promise<Response> {
	if (context.locals.session === null || context.locals.user === null) {
		return new Response("Not authenticated.", {
			status: 401
		});
	}
	if (context.locals.user.emailVerified) {
		return new Response("Not allowed.", {
			status: 403
		});
	}

	let verificationRequest: FaroeUserEmailVerificationRequest;
	try {
		verificationRequest = await faroe.createUserEmailVerificationRequest(context.locals.user.faroeId);
	} catch (e) {
		if (e instanceof FaroeError && e.code === "TOO_MANY_REQUESTS") {
			return new Response("Please try again later.", {
				status: 429
			});
		}
		return new Response("An unknown error occurred. Please try again later.", {
			status: 500
		});
	}

	console.log(`To ${context.locals.user.email}: Your code is ${verificationRequest.code}`);

	return new Response(null, {
		status: 204
	});
}
