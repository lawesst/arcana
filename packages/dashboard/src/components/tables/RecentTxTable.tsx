"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTransactions } from "@/lib/api";
import { truncateAddress, EXPLORER_URLS } from "@arcana/shared";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ErrorState } from "@/components/ErrorState";

export function RecentTxTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchTransactions({ limit: 20 });
      setTransactions(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on new transactions via WebSocket
  useWebSocket({
    onTransaction: load,
  });

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Slower poll since WS handles real-time
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="card">
        <h3 className="card-header mb-4">Recent Transactions</h3>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Recent Transactions</h3>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <h3 className="card-header mb-4">Recent Transactions</h3>
      {transactions.length === 0 ? (
        <div className="py-8 text-center text-slate-500">
          No transactions indexed yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a3040]">
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Hash</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Block</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">From</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">To</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Gas</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">Status</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.txHash}
                  className="border-b border-[#2a3040]/50 hover:bg-[#1a1f2e]/50 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <a
                      href={`${EXPLORER_URLS[42161]}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-arcana-400 hover:text-arcana-300 font-mono"
                    >
                      {truncateAddress(tx.txHash, 6)}
                    </a>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono">{tx.blockNumber}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{truncateAddress(tx.fromAddress)}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {tx.toAddress ? truncateAddress(tx.toAddress) : "\u2014"}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                    {parseInt(tx.gasUsed).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {tx.status === 1 ? (
                      <span className="badge badge-success">Success</span>
                    ) : (
                      <span className="badge badge-error">Reverted</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {tx.isStylus ? (
                      <span className="badge badge-stylus">Stylus</span>
                    ) : (
                      <span className="badge bg-slate-700/50 text-slate-400">EVM</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface Transaction {
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string | null;
  gasUsed: string;
  gasPrice: string;
  status: number;
  isStylus: boolean;
  methodId: string | null;
}
