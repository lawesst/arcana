"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Activity,
  Bell,
  Blocks,
  ChevronRight,
  Layers3,
  LayoutGrid,
  Menu,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { fetchDapps, fetchSearch } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  mobileLabel: string;
}

interface DAppTarget {
  id: string;
  name: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutGrid, mobileLabel: "DASH" },
  {
    label: "Analytics",
    href: "/stylus",
    icon: Activity,
    mobileLabel: "ANALYTICS",
  },
  { label: "Network", href: "/explorer", icon: Blocks, mobileLabel: "NETWORK" },
  {
    label: "Security",
    href: "/alerts",
    icon: ShieldAlert,
    mobileLabel: "SECURITY",
  },
  { label: "Registry", href: "/dapps", icon: Layers3, mobileLabel: "REGISTRY" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    type: string;
    result: unknown;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [targets, setTargets] = useState<DAppTarget[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTargets() {
      try {
        const res = await fetchDapps();
        if (!cancelled) {
          setTargets(
            res.data.map((dapp) => ({
              id: dapp.id,
              name: dapp.name,
            })),
          );
        }
      } catch {
        if (!cancelled) {
          setTargets([]);
        }
      }
    }

    loadTargets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setSearchOpen(true);

    try {
      const res = await fetchSearch(query);
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
    setSearchResult(null);

    if (searchResult.type === "transaction") {
      const tx = searchResult.result as { txHash: string };
      router.push(`/explorer?search=${encodeURIComponent(tx.txHash)}`);
    } else if (searchResult.type === "block") {
      const block = searchResult.result as { blockNumber: number };
      router.push(
        `/explorer?search=${encodeURIComponent(String(block.blockNumber))}`,
      );
    } else if (searchResult.type === "address") {
      const addr = searchResult.result as { address: string };
      router.push(`/explorer?search=${encodeURIComponent(addr.address)}`);
    }

    setSearchQuery("");
    closeSidebar();
  };

  const isActiveRoute = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[#3c494e]/15 bg-[#0e1417]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3 lg:gap-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#161d1f] text-[#bbc9cf] transition-colors hover:text-[#a4e6ff] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" className="shrink-0">
              <span className="text-2xl font-extrabold tracking-[-0.12em] text-[#00d1ff]">
                ARCANA
              </span>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 pb-1 text-sm font-semibold transition-colors ${
                    isActiveRoute(item.href)
                      ? "border-[#00d1ff] text-[#00d1ff]"
                      : "border-transparent text-[#bbc9cf] hover:text-[#a4e6ff]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div ref={searchRef} className="relative hidden lg:block">
              <div className="flex items-center gap-3 rounded-xl border border-[#3c494e]/20 bg-[#161d1f] px-3 py-2">
                <Search className="h-4 w-4 text-[#859399]" />
                <input
                  type="text"
                  placeholder="Search tx hash, address, block..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchResult(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (
                        searchOpen &&
                        searchResult &&
                        searchResult.type !== "none" &&
                        !searching
                      ) {
                        navigateToResult();
                        return;
                      }

                      handleSearch();
                    }

                    if (e.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  className="w-72 bg-transparent text-sm text-[#dde3e7] outline-none placeholder:text-[#859399]"
                />
                {searching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#00d1ff] border-t-transparent" />
                )}
              </div>

              {searchOpen && searchResult && (
                <div className="glass-panel absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[#3c494e]/20 shadow-2xl">
                  {searchResult.type === "none" ? (
                    <div className="px-4 py-3 text-sm text-[#859399]">
                      No indexed result found
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={navigateToResult}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-[#242b2e]/70"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#859399]">
                        {searchResult.type}
                      </div>
                      <div className="mt-1 truncate font-mono text-sm text-[#dde3e7]">
                        {searchResult.type === "transaction"
                          ? (searchResult.result as { txHash: string }).txHash
                          : searchResult.type === "block"
                            ? `#${(searchResult.result as { blockNumber: number }).blockNumber}`
                            : (searchResult.result as { address: string }).address}
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/alerts"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#161d1f] text-[#bbc9cf] transition-colors hover:text-[#a4e6ff] sm:flex"
            >
              <Bell className="h-4 w-4" />
            </Link>

            <Link
              href="/dapps"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#161d1f] text-[#bbc9cf] transition-colors hover:text-[#a4e6ff] sm:flex"
            >
              <Settings2 className="h-4 w-4" />
            </Link>

            <Link
              href="/dapps"
              className="signature-gradient rounded-xl px-4 py-2 text-sm font-extrabold text-[#003543] shadow-[0_8px_28px_rgba(0,209,255,0.18)] transition-transform active:scale-[0.98]"
            >
              Add dApp
            </Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)]">
        {sidebarOpen && (
          <button
            type="button"
            onClick={closeSidebar}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Close sidebar overlay"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 top-[73px] z-50 flex w-72 flex-col border-r border-[#3c494e]/15 bg-[#0e1417] px-4 pb-24 pt-5 transition-transform duration-200 ease-out lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <p className="text-sm font-bold text-[#dde3e7]">Control Rail</p>
            <button
              type="button"
              onClick={closeSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#161d1f] text-[#bbc9cf]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-8 rounded-2xl border border-[#3c494e]/15 bg-[#161d1f] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a2123] text-[#00d1ff]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#dde3e7]">
                  Stylus Core
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#859399]">
                  Arbitrum Mainnet
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#bbc9cf]">
              <span className="h-2 w-2 rounded-full bg-[#00d1ff] shadow-[0_0_14px_rgba(0,209,255,0.8)]"></span>
              Live indexed analytics
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#859399]">
              Select Target
            </p>
            <div className="space-y-2">
              {targets.length === 0 ? (
                <Link
                  href="/dapps"
                  onClick={closeSidebar}
                  className="block rounded-2xl border border-dashed border-[#3c494e]/25 bg-[#161d1f] px-4 py-4 text-sm text-[#bbc9cf] transition-colors hover:text-[#dde3e7]"
                >
                  No monitored dApps yet. Open the registry to add one.
                </Link>
              ) : (
                targets.slice(0, 6).map((target) => {
                  const active = pathname === `/dapps/${target.id}`;

                  return (
                    <Link
                      key={target.id}
                      href={`/dapps/${target.id}`}
                      onClick={closeSidebar}
                      className={`flex items-center justify-between rounded-r-2xl border-l-4 px-4 py-3 transition-all ${
                        active
                          ? "border-[#00d1ff] bg-[#1a2123] text-[#00d1ff]"
                          : "border-transparent bg-transparent text-[#bbc9cf] hover:bg-[#161d1f] hover:text-[#dde3e7]"
                      }`}
                    >
                      <span className="text-sm font-semibold">{target.name}</span>
                      <ChevronRight className="h-4 w-4 opacity-70" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-auto space-y-3">
            <Link
              href="/dapps"
              onClick={closeSidebar}
              className="flex items-center justify-between rounded-2xl border border-[#3c494e]/15 bg-[#161d1f] px-4 py-3 text-sm font-semibold text-[#dde3e7] transition-colors hover:bg-[#1a2123]"
            >
              Open dApp Registry
              <Layers3 className="h-4 w-4 text-[#00d1ff]" />
            </Link>

            <div className="rounded-2xl border border-[#3c494e]/15 bg-[#161d1f] p-4">
              <p className="mb-2 text-xs leading-relaxed text-[#bbc9cf]">
                Unlock historical coverage beyond 30 days and compare more
                protocols side by side.
              </p>
              <button
                type="button"
                className="signature-gradient w-full rounded-xl py-2 text-xs font-extrabold text-[#003543] transition-transform active:scale-[0.98]"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:ml-72">
          <div className="px-4 py-6 lg:px-10 lg:py-8">{children}</div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#3c494e]/15 bg-[#161d1f]/95 px-2 py-3 backdrop-blur xl:hidden">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 ${
                active ? "text-[#00d1ff]" : "text-[#bbc9cf]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold tracking-[0.16em]">
                {item.mobileLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
