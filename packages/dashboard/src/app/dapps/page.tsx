"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchDapps,
  fetchDappBackfillStatus,
  createDapp,
  type BackfillStatus,
} from "@/lib/api";
import { truncateAddress } from "@arcana/shared";
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
  const [backfillStatuses, setBackfillStatuses] = useState<
    Record<string, BackfillStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [addresses, setAddresses] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadStatuses = useCallback(async (activeDapps: DApp[]) => {
    const entries = await Promise.all(
      activeDapps.map(async (dapp) => {
        try {
          const res = await fetchDappBackfillStatus(dapp.id);
          return [dapp.id, res.data] as const;
        } catch {
          return null;
        }
      }),
    );

    setBackfillStatuses(
      Object.fromEntries(
        entries.filter(
          (
            entry,
          ): entry is readonly [string, BackfillStatus] => entry !== null,
        ),
      ),
    );
  }, []);

  const loadDapps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDapps();
      setDapps(res.data);
      await loadStatuses(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dApps");
    } finally {
      setLoading(false);
    }
  }, [loadStatuses]);

  useEffect(() => {
    void loadDapps();
  }, [loadDapps]);

  useEffect(() => {
    const hasActiveBackfill = Object.values(backfillStatuses).some((status) =>
      ["queued", "scanning", "syncing"].includes(status.state),
    );
    if (!hasActiveBackfill) return;

    const interval = setInterval(() => {
      void loadDapps();
    }, 5000);

    return () => clearInterval(interval);
  }, [backfillStatuses, loadDapps]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contractAddresses = addresses
      .split(/[\n,]+/)
      .map((a) => a.trim())
      .filter(Boolean);

    if (!name.trim()) {
      setFormError("Enter a name for the dApp you want to monitor.");
      return;
    }

    if (contractAddresses.length === 0) {
      setFormError("Add at least one contract address to monitor.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await createDapp({
        name: name.trim(),
        contractAddresses,
      });
      setName("");
      setAddresses("");
      setShowForm(false);
      setFormSuccess(`Now monitoring ${res.data.name}.`);
      await loadDapps();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to register dApp",
      );
    } finally {
      setSubmitting(false);
    }
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
          data-testid="toggle-dapp-form"
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
              data-testid="dapp-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Stylus dApp"
              disabled={submitting}
              className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-arcana-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Contract Addresses (comma or newline-separated)
            </label>
            <textarea
              data-testid="dapp-addresses-input"
              value={addresses}
              onChange={(e) => setAddresses(e.target.value)}
              placeholder="0x1234..., 0x5678... or one per line"
              disabled={submitting}
              rows={4}
              className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-arcana-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Duplicate and invalid addresses are rejected automatically.
            </p>
          </div>
          {formError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {formError}
            </div>
          )}
          <button
            data-testid="submit-dapp-form"
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Registering..." : "Register dApp"}
          </button>
        </form>
      )}

      {formSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {formSuccess}
        </div>
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
          {dapps.map((dapp) => {
            const status = backfillStatuses[dapp.id];

            return (
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
                    {status && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                            status.state === "completed"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : status.state === "failed"
                                ? "bg-red-500/10 text-red-300"
                                : "bg-cyan-500/10 text-cyan-300"
                          }`}
                        >
                          {status.state}
                        </span>
                        <span className="text-xs text-slate-500">
                          {status.totalTransactions
                            ? `${status.processedTransactions.toLocaleString()} / ${status.totalTransactions.toLocaleString()} txs`
                            : status.message}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    Added {new Date(dapp.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
