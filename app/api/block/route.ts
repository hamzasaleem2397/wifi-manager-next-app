import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { loginFromSession, blockDevice, unblockDevice } from "@/lib/router";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { mac, action } = body as { mac?: string; action?: "block" | "unblock" };

  if (!mac || !action) {
    return NextResponse.json(
      { error: "mac and action are required." },
      { status: 400 }
    );
  }

  // Login using credentials from session
  const loggedIn = await loginFromSession();

  if (!loggedIn) {
    return NextResponse.json(
      { error: "Could not authenticate with router" },
      { status: 502 }
    );
  }

  const normalised = mac.toUpperCase();

  let success = false;
  if (action === "block") {
    success = await blockDevice(normalised);
    if (success) {
      console.log(`[block-api] blocked ${normalised}`);
    } else {
      console.error(`[block-api] blockDevice failed for ${normalised}`);
    }
  } else {
    success = await unblockDevice(normalised);
    if (success) {
      console.log(`[block-api] unblocked ${normalised}`);
    } else {
      console.error(`[block-api] unblockDevice failed for ${normalised}`);
    }
  }

  if (!success) {
    return NextResponse.json(
      { error: `Failed to ${action} device on router` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
