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
        <h3 className="mb-3 text-lg font-extrabold text-[#dde3e7]">
          Recent Transactions
        </h3>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <h3 className="card-header mb-4">Recent Transactions</h3>
      {transactions.length === 0 ? (
        <div className="py-8 text-center text-[#859399]">
          No transactions indexed yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3c494e]/30">
                <th className="px-3 py-2 text-left font-medium text-[#859399]">Hash</th>
                <th className="px-3 py-2 text-left font-medium text-[#859399]">Block</th>
                <th className="px-3 py-2 text-left font-medium text-[#859399]">From</th>
                <th className="px-3 py-2 text-left font-medium text-[#859399]">To</th>
                <th className="px-3 py-2 text-right font-medium text-[#859399]">Gas</th>
                <th className="px-3 py-2 text-center font-medium text-[#859399]">Status</th>
                <th className="px-3 py-2 text-center font-medium text-[#859399]">Type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.txHash}
                  className="border-b border-[#3c494e]/20 transition-colors hover:bg-[#1a2123]/70"
                >
                  <td className="py-2.5 px-3">
                    <a
                      href={`${EXPLORER_URLS[42161]}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#a4e6ff] hover:text-[#00d1ff]"
                    >
                      {truncateAddress(tx.txHash, 6)}
                    </a>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#dde3e7]">{tx.blockNumber}</td>
                  <td className="py-2.5 px-3 font-mono text-[#bbc9cf]">{truncateAddress(tx.fromAddress)}</td>
                  <td className="py-2.5 px-3 font-mono text-[#bbc9cf]">
                    {tx.toAddress ? truncateAddress(tx.toAddress) : "\u2014"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#dde3e7]">
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
                      <span className="badge">EVM</span>
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
