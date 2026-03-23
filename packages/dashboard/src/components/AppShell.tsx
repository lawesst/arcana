"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchSearch } from "@/lib/api";

const navItems = [
  { label: "Overview", href: "/", icon: "grid" },
  { label: "Stylus", href: "/stylus", icon: "bolt" },
  { label: "dApps", href: "/dapps", icon: "layers" },
  { label: "Explorer", href: "/explorer", icon: "search" },
  { label: "Alerts", href: "/alerts", icon: "bell" },
];

const ICON_MAP: Record<string, string> = {
  grid: "\u25FB",
  bolt: "\u26A1",
  layers: "\u25C8",
  search: "\u2315",
  bell: "\uD83D\uDD14",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    type: string;
    result: unknown;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close sidebar on route change (mobile)
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchOpen(true);
    try {
      const res = await fetchSearch(searchQuery.trim());
      setSearchResult(res.data);
    } catch {
      setSearchResult({ type: "none", result: null });
    } finally {
      setSearching(false);
    }
  };

  const navigateToResult = () => {
    if (!searchResult || searchResult.type === "none") return;
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResult(null);

    if (searchResult.type === "transaction") {
      const tx = searchResult.result as { txHash: string };
      router.push(`/explorer?search=${tx.txHash}`);
    } else if (searchResult.type === "block") {
      const block = searchResult.result as { blockNumber: number };
      router.push(`/explorer?search=${block.blockNumber}`);
    } else if (searchResult.type === "address") {
      const addr = searchResult.result as { address: string };
      router.push(`/explorer?search=${addr.address}`);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111827] border-r border-[#2a3040] flex flex-col transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-[#2a3040] flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              <span className="text-arcana-400">A</span>rcana
            </h1>
            <p className="text-xs text-slate-500 mt-1">Stylus dApp Analytics</p>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#1a1f2e] transition-colors"
            >
              <span className="w-5 h-5 text-center text-xs">
                {ICON_MAP[item.icon]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-[#2a3040]">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Arbitrum One
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-[#2a3040] bg-[#111827]/50 backdrop-blur flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            {/* Search bar */}
            <div ref={searchRef} className="relative">
              <div className="flex items-center bg-[#1a1f2e] rounded-lg border border-[#2a3040] focus-within:border-arcana-500/50">
                <svg className="w-4 h-4 text-slate-500 ml-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search tx hash, address, block..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                    if (e.key === "Escape") setSearchOpen(false);
                  }}
                  className="bg-transparent text-sm text-slate-200 placeholder-slate-500 px-3 py-1.5 w-48 sm:w-64 lg:w-80 outline-none"
                />
                {searching && (
                  <div className="mr-3 w-4 h-4 border-2 border-arcana-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Search results dropdown */}
              {searchOpen && searchResult && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#111827] border border-[#2a3040] rounded-lg shadow-xl overflow-hidden z-50">
                  {searchResult.type === "none" ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      No results found
                    </div>
                  ) : searchResult.type === "transaction" ? (
                    <button
                      onClick={navigateToResult}
                      className="w-full px-4 py-3 text-left hover:bg-[#1a1f2e] transition-colors"
                    >
                      <div className="text-xs text-arcana-400 font-medium">Transaction</div>
                      <div className="text-sm text-slate-300 font-mono truncate">
                        {(searchResult.result as { txHash: string }).txHash}
                      </div>
                    </button>
                  ) : searchResult.type === "block" ? (
                    <button
                      onClick={navigateToResult}
                      className="w-full px-4 py-3 text-left hover:bg-[#1a1f2e] transition-colors"
                    >
                      <div className="text-xs text-arcana-400 font-medium">Block</div>
                      <div className="text-sm text-slate-300 font-mono">
                        #{(searchResult.result as { blockNumber: number }).blockNumber}
                      </div>
                    </button>
                  ) : searchResult.type === "address" ? (
                    <button
                      onClick={navigateToResult}
                      className="w-full px-4 py-3 text-left hover:bg-[#1a1f2e] transition-colors"
                    >
                      <div className="text-xs text-arcana-400 font-medium">
                        Address ({((searchResult.result as { transactions: unknown[] }).transactions).length} txs)
                      </div>
                      <div className="text-sm text-slate-300 font-mono truncate">
                        {(searchResult.result as { address: string }).address}
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">Chain: 42161</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-emerald-400">Live</span>
          </div>
        </header>
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
