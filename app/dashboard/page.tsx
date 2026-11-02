"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "../components/ThemeToggle";

// ── types ────────────────────────────────────────────────────────────────────

interface Device {
  mac: string;
  ip: string;
  hostname: string;
  leaseTime?: string;
  status?: string;   // "Online" | "Offline"
  port?: string;
  alias: string | null;
  blocked: boolean;
}

type FilterTab = "all" | "online" | "offline" | "blocked";

// ── helpers ──────────────────────────────────────────────────────────────────

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
      />
    </svg>
  );
}

function BlockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
      />
    </svg>
  );
}

// ── device row ───────────────────────────────────────────────────────────────

function DeviceRow({
  device,
  onBlock,
  onAlias,
}: {
  device: Device;
  onBlock: (mac: string, action: "block" | "unblock") => Promise<void>;
  onAlias: (mac: string, alias: string) => Promise<void>;
}) {
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(device.alias ?? "");
  const [busy, setBusy] = useState(false);

  const displayName = device.alias || device.hostname || "Unknown Device";

  async function handleBlock() {
    setBusy(true);
    await onBlock(device.mac, device.blocked ? "unblock" : "block");
    setBusy(false);
  }

  async function handleAliasSave() {
    setBusy(true);
    await onAlias(device.mac, aliasInput);
    setEditingAlias(false);
    setBusy(false);
  }

  return (
    <div
      className={`bg-white dark:bg-gray-900 border rounded-lg transition hover:bg-gray-50 dark:hover:bg-gray-850 shadow-sm dark:shadow-none ${
        device.blocked
          ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            device.blocked ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"
          }`}
        >
          {device.blocked ? (
            <BlockIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
          ) : (
            <WifiIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>

        {/* Name & Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{displayName}</h3>
            <span
              className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                device.blocked
                  ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                  : device.status === "Offline"
                  ? "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-500"
                  : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400"
              }`}
            >
              {device.blocked ? "Blocked" : device.status === "Offline" ? "Offline" : "Online"}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono">{device.mac}</span>
            {device.ip && <span className="font-mono">{device.ip}</span>}
            {device.port && <span>{device.port}</span>}
          </div>
          
          {/* Alias editor */}
          {editingAlias ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Enter nickname..."
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAliasSave();
                  if (e.key === "Escape") setEditingAlias(false);
                }}
                autoFocus
              />
              <button
                onClick={handleAliasSave}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded transition disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditingAlias(false)}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs font-medium px-3 py-1 rounded transition"
              >
                Cancel
              </button>
            </div>
          ) : device.alias ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-500">aka {device.hostname}</span>
              <button
                onClick={() => {
                  setAliasInput(device.alias ?? "");
                  setEditingAlias(true);
                }}
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAliasInput("");
                setEditingAlias(true);
              }}
              className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition mt-1"
            >
              <PencilIcon className="w-3 h-3" />
              Add nickname
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          <button
            onClick={handleBlock}
            disabled={busy}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
              device.blocked
                ? "bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800"
                : "bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"
            }`}
          >
            {busy ? "..." : device.blocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const fetchDevices = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/devices");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch devices");
      const data = await res.json();
      setDevices(data.devices ?? []);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load devices.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDevices();
    // Auto-refresh every 30 seconds
    const id = setInterval(fetchDevices, 40_000);
    return () => clearInterval(id);
  }, [fetchDevices]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleBlock(mac: string, action: "block" | "unblock") {
    await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac, action }),
    });
    await fetchDevices();
  }

  async function handleAlias(mac: string, alias: string) {
    await fetch("/api/alias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac, alias }),
    });
    await fetchDevices();
  }

  // Filter devices based on active tab
  const filteredDevices = devices.filter((d) => {
    if (activeTab === "online") return !d.blocked && d.status === "Online";
    if (activeTab === "offline") return !d.blocked && d.status === "Offline";
    if (activeTab === "blocked") return d.blocked;
    return true; // "all"
  });

  const onlineCount = devices.filter((d) => !d.blocked && d.status === "Online").length;
  const offlineCount = devices.filter((d) => !d.blocked && d.status === "Offline").length;
  const blockedCount = devices.filter((d) => d.blocked).length;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 z-10 shadow-sm dark:shadow-none">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 dark:bg-blue-700 rounded-xl flex items-center justify-center">
              <WifiIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white leading-none">
                WiFi Manager
              </h1>
              <p className="text-gray-500 dark:text-gray-500 text-xs mt-0.5">Huawei HG8145C</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-gray-500 dark:text-gray-600 text-xs hidden sm:block">
                {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchDevices}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              ↻ Refresh
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-6xl w-full mx-auto px-4 py-6">
        {/* Stats */}
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center shadow-sm dark:shadow-none">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{devices.length}</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Total</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center shadow-sm dark:shadow-none">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{onlineCount}</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Online</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center shadow-sm dark:shadow-none">
            <p className="text-3xl font-bold text-gray-500 dark:text-gray-400">{offlineCount}</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Offline</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center shadow-sm dark:shadow-none">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{blockedCount}</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Blocked</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex-shrink-0 flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "all"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            All ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab("online")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "online"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Online ({onlineCount})
          </button>
          <button
            onClick={() => setActiveTab("offline")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "offline"
                ? "border-gray-500 text-gray-600 dark:text-gray-400"
                : "border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Offline ({offlineCount})
          </button>
          <button
            onClick={() => setActiveTab("blocked")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "blocked"
                ? "border-red-500 text-red-600 dark:text-red-400"
                : "border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Blocked ({blockedCount})
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 text-red-600 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Scrollable device area */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-gray-300
          dark:[&::-webkit-scrollbar-thumb]:bg-gray-700
          [&::-webkit-scrollbar-thumb]:hover:bg-gray-400
          dark:[&::-webkit-scrollbar-thumb]:hover:bg-gray-600">

          {/* Loading */}
          {loading && (
            <div className="text-center py-16 text-gray-500 dark:text-gray-500">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p>Loading devices...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredDevices.length === 0 && devices.length === 0 && (
            <div className="text-center py-16 text-gray-500 dark:text-gray-500">
              <WifiIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
              <p className="font-medium text-gray-600 dark:text-gray-400">No devices found</p>
              <p className="text-sm mt-1">Check router connection</p>
            </div>
          )}

          {/* No results for filter */}
          {!loading && !error && filteredDevices.length === 0 && devices.length > 0 && (
            <div className="text-center py-16 text-gray-500 dark:text-gray-500">
              <p className="font-medium text-gray-600 dark:text-gray-400">No {activeTab} devices</p>
            </div>
          )}

          {/* Device List */}
          {filteredDevices.length > 0 && (
            <div className="space-y-2 pb-4">
              {filteredDevices.map((d) => (
                <DeviceRow
                  key={d.mac}
                  device={d}
                  onBlock={handleBlock}
                  onAlias={handleAlias}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
