import { verifyEmailInput, FaroeError } from "@faroe/sdk";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { faroe } from "@lib/faroe";
import { setSessionFaroeEmailUpdateRequestId } from "@lib/session";

import type { APIContext } from "astro";
import type { FaroeEmailUpdateRequest } from "@faroe/sdk";

export async function POST(context: APIContext): Promise<Response> {
	if (context.locals.session === null || context.locals.user === null) {
		return new Response("Not authenticated.", {
			status: 401
		});
	}

	const data = await context.request.json();
	const parser = new ObjectParser(data);

	let email: string;

	try {
		email = parser.getString("email");
	} catch (e) {
		return new Response("Invalid request body.", {
			status: 400
		});
	}

	if (!verifyEmailInput(email)) {
		return new Response("Please enter a valid email address.", {
			status: 400
		});
	}

	let updateRequest: FaroeEmailUpdateRequest;
	try {
		updateRequest = await faroe.createUserEmailUpdateRequest(context.locals.user.faroeId, email);
	} catch (e) {
		if (e instanceof FaroeError && e.code === "EMAIL_ALREADY_USED") {
			return new Response("This email address is already used.", {
				status: 400
			});
		}
		if (e instanceof FaroeError && e.code === "TOO_MANY_REQUESTS") {
			return new Response("Please try again later.", {
				status: 429
			});
		}
		return new Response("An unknown error occurred. Please try again later.", {
			status: 500
		});
	}

	console.log(`To ${email}: Your code is ${updateRequest.code}`);

	setSessionFaroeEmailUpdateRequestId(context.locals.session.id, updateRequest.id);

	return new Response(null, {
		status: 204
	});
}
