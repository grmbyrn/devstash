import { NextResponse } from "next/server";

import { registerUser } from "@/lib/auth/register";
import {
  checkRateLimit,
  getClientIp,
  rateLimitMessage,
  retryAfterSeconds,
} from "@/lib/rate-limit";

/**
 * POST /api/auth/register
 *
 * Registers a new email/password user for external/programmatic clients. The
 * sign-up UI submits through the `registerAction` server action instead; both
 * share `registerUser`. Returns the `{ success, data, error }` shape.
 */
export async function POST(request: Request) {
  try {
    const ip = await getClientIp();
    const limit = await checkRateLimit("register", ip);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: rateLimitMessage(limit.reset) },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds(limit.reset)) },
        },
      );
    }

    const body = await request.json();
    const result = await registerUser(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
