import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { setAlias, removeAlias, getAliases } from "@/lib/aliases";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ aliases: getAliases() });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { mac, alias } = body as { mac?: string; alias?: string };

  if (!mac) {
    return NextResponse.json({ error: "mac is required." }, { status: 400 });
  }

  if (!alias || alias.trim() === "") {
    removeAlias(mac);
  } else {
    setAlias(mac, alias.trim());
  }

  return NextResponse.json({ ok: true });
}
