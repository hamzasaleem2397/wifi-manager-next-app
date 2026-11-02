import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { loginToRouter, setWifiEnabled } from "@/lib/router";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { enabled } = body as { enabled?: boolean };

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
  }

  const routerUser = process.env.ROUTER_USERNAME ?? "telecomadmin";
  const routerPass = process.env.ROUTER_PASSWORD ?? "admintelecom";
  const loggedIn = await loginToRouter(routerUser, routerPass);

  if (!loggedIn) {
    return NextResponse.json({ error: "Could not authenticate with router" }, { status: 502 });
  }

  const ok = await setWifiEnabled(enabled);
  return NextResponse.json({ ok });
}
