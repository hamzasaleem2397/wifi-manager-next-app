import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { loginFromSession, getConnectedDevices, getBlockedMacs } from "@/lib/router";
import { getAliases } from "@/lib/aliases";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Login using credentials from session
  const loggedIn = await loginFromSession();

  if (!loggedIn) {
    return NextResponse.json(
      { error: "Could not authenticate with router" },
      { status: 502 }
    );
  }

  const [rawDevices, aliases, blockedMacs] = await Promise.all([
    getConnectedDevices(),
    Promise.resolve(getAliases()),
    getBlockedMacs(),
  ]);

  const devices = rawDevices.map((d) => ({
    ...d,
    alias: aliases[d.mac.toUpperCase()] ?? null,
    blocked: blockedMacs.includes(d.mac.toUpperCase()),
  }));

  console.log(`[devices-api] found ${devices.length} devices, ${devices.filter(d => d.blocked).length} blocked`);

  return NextResponse.json({ devices });
}
