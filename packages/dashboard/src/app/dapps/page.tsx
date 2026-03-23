"use client";

import { useState, useEffect } from "react";
import { fetchDapps, createDapp } from "@/lib/api";
import { truncateAddress, EXPLORER_URLS } from "@arcana/shared";
import { ErrorState } from "@/components/ErrorState";

interface DApp {
  id: string;
  name: string;
  contractAddresses: string[];
  chainId: number;
  createdAt: string;
}

export default function DAppsPage() {
  const [dapps, setDapps] = useState<DApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [addresses, setAddresses] = useState("");

  useEffect(() => {
    loadDapps();
  }, []);

  async function loadDapps() {
    setError(null);
    try {
      const res = await fetchDapps();
      setDapps(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dApps");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contractAddresses = addresses
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    if (!name || contractAddresses.length === 0) return;

    await createDapp({ name, contractAddresses });
    setName("");
    setAddresses("");
    setShowForm(false);
    loadDapps();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Monitored dApps</h2>
          <p className="text-sm text-slate-400 mt-1">
            Register Stylus dApp contracts to track their performance
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700 transition-colors"
        >
          + Add dApp
        </button>
      </div>

      {/* Add dApp form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              dApp Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Stylus dApp"
              className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-arcana-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Contract Addresses (comma-separated)
            </label>
            <input
              type="text"
              value={addresses}
              onChange={(e) => setAddresses(e.target.value)}
              placeholder="0x1234..., 0x5678..."
              className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-arcana-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700"
          >
            Register dApp
          </button>
        </form>
      )}

      {/* dApp list */}
      {error ? (
        <ErrorState message={error} onRetry={loadDapps} />
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-slate-800 rounded w-48 mb-2"></div>
              <div className="h-4 bg-slate-800 rounded w-96"></div>
            </div>
          ))}
        </div>
      ) : dapps.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-lg mb-2">No dApps registered yet</p>
          <p className="text-slate-500 text-sm">
            Click &quot;+ Add dApp&quot; to start monitoring a Stylus contract
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dapps.map((dapp) => (
            <a
              key={dapp.id}
              href={`/dapps/${dapp.id}`}
              className="card block hover:border-arcana-700/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {dapp.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {dapp.contractAddresses.map((addr) => (
                      <span
                        key={addr}
                        className="font-mono text-xs text-arcana-400 bg-arcana-500/10 px-2 py-0.5 rounded"
                      >
                        {truncateAddress(addr, 8)}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  Added {new Date(dapp.createdAt).toLocaleDateString()}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
