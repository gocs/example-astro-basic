import { faroe } from "@lib/faroe";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { FaroeError } from "@faroe/sdk";
import { deleteSessionFaroeEmailUpdateRequestId } from "@lib/session";
import { updateUserEmailAndSetEmailAsVerified } from "@lib/user";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	if (context.locals.session === null || context.locals.user === null) {
		return new Response("Not authenticated.", { status: 400 });
	}
	if (!context.locals.user.emailVerified) {
		return new Response("Not allowed.", { status: 403 });
	}
	if (context.locals.session.faroeEmailUpdateRequestId === null) {
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

	let updatedEmail: string;
	try {
		updatedEmail = await faroe.verifyNewUserEmail(context.locals.session.faroeEmailUpdateRequestId, code);
	} catch (e) {
		if (e instanceof FaroeError && e.code === "INVALID_REQUEST_ID") {
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

	updateUserEmailAndSetEmailAsVerified(context.locals.user.id, updatedEmail);
	deleteSessionFaroeEmailUpdateRequestId(context.locals.session.id);

	return new Response(null, { status: 204 });
}
