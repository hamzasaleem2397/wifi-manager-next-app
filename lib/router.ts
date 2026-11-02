/**
 * Huawei HG8145C ONT router interface.
 *
 * Login flow (from router's own login.asp JS):
 *   1. GET  /asp/GetRandCount.asp        → token string
 *   2. POST /login.cgi with:
 *        UserName     = <username>
 *        PassWord     = base64(password)
 *        x.X_HW_Token = <token>
 *      Cookie header  = "Cookie=body:Language:english:id=-1;path=/"
 *   3. Response sets:
 *        Cookie=sid=<hash>:Language:english:id=1
 *
 * Device pages (from router's frame.asp nav map):
 *   Connected devices : html/bbsp/userdevinfo/userdevinfo.asp
 *   DHCP info         : html/bbsp/dhcpinfo/dhcpinfo.asp
 *   WiFi coverage     : html/amp/wificoverinfo/wlancoverinfo.asp  (has MACs)
 *   WLAN MAC filter   : html/bbsp/wlanmacfilter/wlanmacfilter.asp
 *   WLAN basic config : html/amp/wlanbasic/WlanBasic.asp
 */

import { Buffer } from "buffer";
import { getRouterCredentials } from "./auth";

let ROUTER_BASE = "http://192.168.100.1";

let sessionCookie: string | null = null;

// ─── helpers ────────────────────────────────────────────────────────────────

function makeHeaders(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (WiFiManager/1.0)",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${ROUTER_BASE}/`,
  };
  if (sessionCookie) base["Cookie"] = sessionCookie;
  return { ...base, ...extra };
}

function extractAllCookies(res: Response): string | null {
  let rawCookies: string[] = [];
  if (typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
    rawCookies = (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie();
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) rawCookies = [raw];
  }
  if (rawCookies.length === 0) return null;
  // Router sends "Cookie=sid=XXX:Language:english:id=1;path=/" — no space after ";"
  // Strip everything from the first ";" onward (those are cookie attributes)
  return rawCookies.map(c => {
    const attrIdx = c.indexOf(";");
    return attrIdx >= 0 ? c.slice(0, attrIdx) : c;
  }).filter(Boolean).join("; ");
}

// ─── login ──────────────────────────────────────────────────────────────────

export async function loginToRouter(
  routerIp: string,
  routerUser: string,
  routerPass: string
): Promise<boolean> {
  // Update ROUTER_BASE with the provided IP
  ROUTER_BASE = `http://${routerIp}`;
  
  // Step 1 — get challenge token
  let token = "";
  try {
    const r = await fetch(`${ROUTER_BASE}/asp/GetRandCount.asp`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) token = (await r.text()).trim();
  } catch (e) {
    console.warn("[router] GetRandCount failed:", e);
    return false;
  }

  // Step 2 — POST credentials
  try {
    const res = await fetch(`${ROUTER_BASE}/login.cgi`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (WiFiManager/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html,application/xhtml+xml",
        Referer: `${ROUTER_BASE}/`,
        // Pre-login cookie required by the router
        Cookie: "Cookie=body:Language:english:id=-1;path=/",
      },
      body: new URLSearchParams({
        UserName: routerUser,
        PassWord: Buffer.from(routerPass).toString("base64"),
        "x.X_HW_Token": token,
      }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    const cookie = extractAllCookies(res);
    console.log(`[router] login → status=${res.status} cookie=${cookie}`);

    // Successful login: cookie contains id=1 (failed login keeps id=-1)
    if (cookie && cookie.includes("id=1")) {
      sessionCookie = cookie;
      return true;
    }

    console.error("[router] login failed — cookie does not contain id=1 (wrong credentials or cookie parse error)");
    return false;
  } catch (e) {
    console.error("[router] login threw:", e);
    return false;
  }
}

/**
 * Helper to login using credentials from the session cookie
 */
export async function loginFromSession(): Promise<boolean> {
  const creds = await getRouterCredentials();
  if (!creds) {
    console.warn("[router] No credentials in session");
    return false;
  }
  return loginToRouter(creds.ip, creds.username, creds.password);
}

// ─── connected devices ───────────────────────────────────────────────────────

export interface ConnectedDevice {
  mac: string;
  ip: string;
  hostname: string;
  leaseTime?: string;
  status?: string;   // "Online" | "Offline"
  port?: string;     // "SSID0" | "SSID1" | "LAN1" etc.
}

export async function getConnectedDevices(): Promise<ConnectedDevice[]> {
  if (!sessionCookie) {
    console.warn("[router] no session");
    return [];
  }

  // GetLanUserDevInfo.asp has live Online/Offline status per device.
  // GetLanUserDhcpInfo.asp has DHCP lease times but no online status.
  // Try DevInfo first (richer), fall back to DhcpInfo.
  const dataUrls = [
    `${ROUTER_BASE}/html/bbsp/common/GetLanUserDevInfo.asp`,
    `${ROUTER_BASE}/html/bbsp/common/GetLanUserDhcpInfo.asp`,
  ];

  for (const url of dataUrls) {
    try {
      const res = await fetch(url, {
        headers: makeHeaders({ Accept: "text/html,*/*" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[router] ${url} → ${res.status}`);
        continue;
      }

      const html = await res.text();
      console.log(`[router] fetched ${url} (${html.length} bytes)`);

      const userDevices = parseUSERDeviceScript(html);
      if (userDevices.length > 0) {
        console.log(`[router] got ${userDevices.length} devices from USERDevice script`);
        return userDevices;
      }

      const dhcpDevices = parseDhcpInfoScript(html);
      if (dhcpDevices.length > 0) {
        console.log(`[router] got ${dhcpDevices.length} devices from DHCPInfo script`);
        return dhcpDevices;
      }

      console.log(`[router] no device data found in ${url}`);
    } catch (e) {
      console.warn(`[router] fetch ${url} failed:`, e);
    }
  }

  return [];
}

/**
 * Unescapes \xNN sequences in a string (router encodes "." as \x2e, ":" as \x3a, etc.)
 */
function unescapeHex(s: string): string {
  return s.replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Splits a JS argument list on commas, respecting quoted strings, then strips
 * outer quotes and unescapes \xNN sequences.
 */
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = "";
  let inString = false;
  let quote = "";

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      quote = ch;
    } else if (inString && ch === quote && argsStr[i - 1] !== "\\") {
      inString = false;
    } else if (!inString && ch === ",") {
      args.push(unescapeHex(current.trim().replace(/^["']|["']$/g, "")));
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    args.push(unescapeHex(current.trim().replace(/^["']|["']$/g, "")));
  }
  return args;
}

/**
 * Parses GetLanUserDhcpInfo.asp which contains:
 *
 *   var UserDhcpinfo = new Array(
 *     new DHCPInfo(domain, name, ip, mac, remaintime, devtype, interfacetype, AddressSource),
 *     ...
 *   )
 *
 * Args are hex-escaped: \x2e = ".", \x3a = ":"
 * Signature: DHCPInfo(domain, name, ip, mac, remaintime, devtype, interfacetype, AddressSource)
 *                      [0]    [1]  [2] [3]  [4]         [5]      [6]            [7]
 */
function parseDhcpInfoScript(html: string): ConnectedDevice[] {
  const devices: ConnectedDevice[] = [];
  const re = /new\s+DHCPInfo\s*\(([^)]+)\)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const args = splitArgs(m[1]);
    if (args.length < 4) continue;

    const hostname  = args[1] || args[0] || "Unknown";  // name, fallback to domain
    const ip        = args[2] || "";
    const mac       = args[3] || "";
    const leaseTime = args[4] ?? undefined;

    if (!/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(mac)) continue;

    devices.push({ mac: mac.toUpperCase(), ip, hostname, leaseTime });
  }

  return devices;
}

/**
 * Parses GetLanUserDevInfo.asp which contains:
 *
 *   new USERDevice(Domain, IpAddr, MacAddr, Port, IpType, DevType, DevStatus,
 *                  PortType, Time, HostName, IPv4Enabled, IPv6Enabled, DeviceType)
 *                  [0]     [1]    [2]       [3]   [4]    [5]       [6]
 *                  [7]      [8]   [9]       [10]  [11]   [12]
 *
 * Real example: ("...X_HW_UserDev.1","192.168.100.45","50:b0:3b:bd:51:72",
 *   "SSID0","DHCP","PS5","Offline","WIFI","12:55","","1","1","0")
 */
function parseUSERDeviceScript(html: string): ConnectedDevice[] {
  const devices: ConnectedDevice[] = [];
  const re = /new\s+USERDevice\s*\(([^)]+)\)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const args = splitArgs(m[1]);
    if (args.length < 3) continue;

    const ip       = args[1] || "";
    const mac      = args[2] || "";
    const port     = args[3] || "";
    const devStatus = args[6] || "";
    const hostname = args[9] || args[5] || args[0] || "Unknown";

    if (!/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(mac)) continue;

    devices.push({ mac: mac.toUpperCase(), ip, hostname, status: devStatus, port });
  }

  return devices;
}

// ─── block / unblock device ──────────────────────────────────────────────────
//
// WLAN MAC Filter (wlanmacfilter.asp) — WiFi-only blocking
//
// BindFields:
//   x.WlanMacFilterRight   (enable/disable filter)
//   x.WlanMacFilterPolicy  (0=blacklist, 1=whitelist)
//
// Add SpecParaPairs:
//   x.SourceMACAddress
//   x.SSIDName (e.g. "SSID-1" for SSID1)
//   x.Enable (1)
//
// add.cgi URL: InternetGatewayDevice.X_HW_Security.WLANMacFilter

interface WlanMacfilterPage {
  token: string;
  enableFilter: string;
  filterMode: string;
  entries: { domain: string; ssid: string; mac: string }[];
}

async function getWlanMacfilterPage(): Promise<WlanMacfilterPage | null> {
  if (!sessionCookie) return null;
  try {
    const res = await fetch(`${ROUTER_BASE}/html/bbsp/wlanmacfilter/wlanmacfilter.asp`, {
      headers: makeHeaders({ Accept: "text/html,*/*" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { 
      console.error(`[router] getWlanMacfilterPage: fetch failed with status ${res.status}`);
      return null; 
    }
    const html = await res.text();
    const token = html.match(/id="hwonttoken"[^>]*value="([^"]+)"/)?.[1]
               ?? html.match(/value="([^"]+)"[^>]*id="hwonttoken"/)?.[1];
    if (!token) { console.error("[router] getWlanMacfilterPage: no token"); return null; }
    const enableFilter = html.match(/var\s+enableFilter\s*=\s*'(\d)'/)?.[1] ?? "0";
    const filterMode   = html.match(/var\s+Mode\s*=\s*'(\d)'/)?.[1] ?? "0";
    
    // stMacFilter(domain, SSIDName, MACAddress) - SSID is 2nd param, MAC is 3rd
    const entries = [...html.matchAll(/new\s+stMacFilter\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)]
      .map(m => {
        const domain = m[1];
        const ssid = m[2];
        const macRaw = m[3];
        const macUnescaped = unescapeHex(macRaw);
        return { domain, ssid: unescapeHex(ssid), mac: macUnescaped.toUpperCase() };
      });
    
    return { token, enableFilter, filterMode, entries };
  } catch (e) {
    console.error("[router] getWlanMacfilterPage failed:", e);
    return null;
  }
}

/**
 * Get list of MAC addresses currently blocked by the router's WLAN MAC filter.
 * Returns empty array if filter is disabled or on error.
 */
export async function getBlockedMacs(): Promise<string[]> {
  if (!sessionCookie) {
    console.warn("[router] getBlockedMacs: no session");
    return [];
  }
  
  try {
    const page = await getWlanMacfilterPage();
    if (!page) {
      console.warn("[router] getBlockedMacs: could not load filter page");
      return [];
    }
    
    // Only return MACs if filter is enabled and in blacklist mode
    if (page.enableFilter === "1" && page.filterMode === "0") {
      const macs = page.entries.map(e => e.mac);
      console.log(`[router] getBlockedMacs: found ${macs.length} blocked MACs`);
      return macs;
    }
    
    console.log(`[router] getBlockedMacs: filter disabled or not in blacklist mode`);
    return [];
  } catch (e) {
    console.error("[router] getBlockedMacs threw:", e);
    return [];
  }
}

function extractPageToken(html: string, fallback: string): string {
  return html.match(/id="hwonttoken"[^>]*value="([^"]+)"/)?.[1]
      ?? html.match(/value="([^"]+)"[^>]*id="hwonttoken"/)?.[1]
      ?? fallback;
}

export async function blockDevice(mac: string): Promise<boolean> {
  if (!sessionCookie) { console.warn("[router] blockDevice: no session"); return false; }
  try {
    const page = await getWlanMacfilterPage();
    if (!page) { console.error("[router] blockDevice: could not load wlanmacfilter page"); return false; }
    console.log(`[router] blockDevice mac=${mac} currentMode=${page.filterMode} enableFilter=${page.enableFilter}`);

    // Step 1: enable WLAN filter in blacklist mode
    const enableRes = await fetch(
      `${ROUTER_BASE}/set.cgi?x=InternetGatewayDevice.X_HW_Security&RequestFile=html/bbsp/wlanmacfilter/wlanmacfilter.asp`, {
      method: "POST",
      headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: new URLSearchParams({
        "x.WlanMacFilterRight":  "1",
        "x.WlanMacFilterPolicy": "0",  // 0=blacklist
        "x.X_HW_Token":          page.token,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    const enableHtml = await enableRes.text();
    const tok2 = extractPageToken(enableHtml, page.token);
    const err1 = enableHtml.match(/ErrCode\s*=\s*"([^"]+)"/)?.[1];
    console.log(`[router] blockDevice set.cgi → ${enableRes.status} errCode=${err1 ?? "none"}`);
    if (err1) return false;

    // Step 2: add MAC to WLAN filter (blocks on all SSIDs by using SSID-1 or SSID-0)
    const addRes = await fetch(
      `${ROUTER_BASE}/add.cgi?x=InternetGatewayDevice.X_HW_Security.WLANMacFilter&RequestFile=html/bbsp/wlanmacfilter/wlanmacfilter.asp`, {
      method: "POST",
      headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: new URLSearchParams({
        "x.SourceMACAddress": mac,
        "x.SSIDName":         "SSID-1",  // Apply to SSID1 (adjust if needed)
        "x.Enable":           "1",
        "x.X_HW_Token":       tok2,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    const addHtml = await addRes.text();
    const err2 = addHtml.match(/ErrCode\s*=\s*"([^"]+)"/)?.[1];
    console.log(`[router] blockDevice add.cgi → ${addRes.status} errCode=${err2 ?? "none"}`);
    return !err2;
  } catch (e) {
    console.error("[router] blockDevice threw:", e);
    return false;
  }
}

export async function unblockDevice(mac: string): Promise<boolean> {
  if (!sessionCookie) { console.warn("[router] unblockDevice: no session"); return false; }
  
  try {
    console.log(`[router] unblockDevice called for MAC: ${mac}`);
    const page = await getWlanMacfilterPage();
    if (!page) { 
      console.error("[router] unblockDevice: could not load wlanmacfilter page"); 
      return false; 
    }
    
    const entry = page.entries.find(e => e.mac === mac.toUpperCase());
    if (!entry) { 
      console.warn(`[router] unblockDevice: ${mac} not in filter list - already unblocked`); 
      return true; 
    }
    
    console.log(`[router] Found entry to delete: domain=${entry.domain}, ssid=${entry.ssid}, mac=${entry.mac}`);

    // Try the router's removeClick() approach: just domain + token, using RequestFile in URL
    const params = {
      [entry.domain]: "",
      "x.X_HW_Token": page.token,
    };
    console.log(`[router] DELETE params (removeClick approach):`, params);

    const delRes = await fetch(
      `${ROUTER_BASE}/del.cgi?RequestFile=html/bbsp/wlanmacfilter/wlanmacfilter.asp`, {
      method: "POST",
      headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(8000),
    });
    
    const delHtml = await delRes.text();
    const err = delHtml.match(/ErrCode\s*=\s*"([^"]+)"/)?.[1];
    console.log(`[router] unblockDevice del.cgi → status=${delRes.status} errCode=${err ?? "none"}`);
    
    if (err) {
      console.error(`[router] Delete failed with error: ${err}, trying alternative approach...`);
      
      // Fallback: disable the entire filter
      console.log(`[router] Falling back to disabling WLAN MAC filter entirely`);
      const disableRes = await fetch(
        `${ROUTER_BASE}/set.cgi?x=InternetGatewayDevice.X_HW_Security&RequestFile=html/bbsp/wlanmacfilter/wlanmacfilter.asp`, {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: new URLSearchParams({
          "x.WlanMacFilterRight": "0",
          "x.WlanMacFilterPolicy": "0",
          "x.X_HW_Token": page.token,
        }).toString(),
        signal: AbortSignal.timeout(8000),
      });
      const disableHtml = await disableRes.text();
      const disableErr = disableHtml.match(/ErrCode\s*=\s*"([^"]+)"/)?.[1];
      console.log(`[router] Disable filter → status=${disableRes.status} errCode=${disableErr ?? "none"}`);
      
      if (disableErr) {
        console.error(`[router] Both delete and disable failed!`);
        return false;
      }
      
      console.log(`[router] SUCCESS: Filter disabled. Device ${mac} can now connect.`);
      console.log(`[router] Note: All blocked devices are now unblocked.`);
      return true;
    }
    
    // Verify deletion
    const verifyPage = await getWlanMacfilterPage();
    if (verifyPage) {
      const stillThere = verifyPage.entries.find(e => e.mac === mac.toUpperCase());
      if (stillThere) {
        console.error(`[router] Entry still in filter list after delete!`);
        return false;
      } else {
        console.log(`[router] SUCCESS: ${mac} removed from filter`);
      }
    }
    
    return true;
  } catch (e) {
    console.error("[router] unblockDevice threw:", e);
    return false;
  }
}
// ─── WiFi enable / disable ───────────────────────────────────────────────────

/**
 * Disable or enable the WiFi radio entirely.
 * Uses the WLAN Basic Configuration page's form action.
 */
export async function setWifiEnabled(enabled: boolean): Promise<boolean> {
  if (!sessionCookie) return false;
  try {
    const token = await getToken();
    const body = new URLSearchParams({
      "x.X_HW_Token": token,
      "IF.Enable": enabled ? "1" : "0",
      "RequestFile": "html/amp/wlanbasic/WlanBasic.asp",
    });
    const res = await fetch(`${ROUTER_BASE}/html/amp/wlanbasic/WlanBasic.cgi`, {
      method: "POST",
      headers: makeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: body.toString(),
    });
    return res.ok || res.status < 400;
  } catch {
    return false;
  }
}

// ─── internal helpers ────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  try {
    const r = await fetch(`${ROUTER_BASE}/asp/GetRandCount.asp`, {
      headers: makeHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    return (await r.text()).trim();
  } catch {
    return "";
  }
}
