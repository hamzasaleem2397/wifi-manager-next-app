import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { Buffer } from "buffer";

async function validateRouterCredentials(
  ip: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    // Get token from router
    const tokenRes = await fetch(`http://${ip}/asp/GetRandCount.asp`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!tokenRes.ok) return false;
    const token = (await tokenRes.text()).trim();
console.log(token,"token")
    // Try to login
    const loginRes = await fetch(`http://${ip}/login.cgi`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `http://${ip}/`,
        Cookie: "Cookie=body:Language:english:id=-1;path=/",
      },
      body: new URLSearchParams({
        UserName: username,
        PassWord: Buffer.from(password).toString("base64"),
        "x.X_HW_Token": token,
      }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
console.log(loginRes,"RLOGIN RES")
    // Check if login was successful by looking for id=1 in cookie
    const setCookieHeader = loginRes.headers.get("set-cookie");
    if (!setCookieHeader) return false;
    
    return setCookieHeader.includes("id=1");
  } catch (e) {
    console.error("[login] Router validation failed:", e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { ip, username, password } = body as {
    ip?: string;
    username?: string;
    password?: string;
  };

  if (!ip || !username || !password) {
    return NextResponse.json(
      { error: "Router IP, username, and password are required." },
      { status: 400 }
    );
  }

  // Validate IP format (basic check)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) {
    return NextResponse.json(
      { error: "Invalid IP address format." },
      { status: 400 }
    );
  }

  // Validate credentials against the actual router
  const isValid = await validateRouterCredentials(ip, username, password);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid router credentials or unable to connect to router." },
      { status: 401 }
    );
  }

  // Create session with router credentials
  await createSession({ ip, username, password });
  return NextResponse.json({ ok: true });
}
