"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTransactions, fetchRecentBlocks, fetchEvents, fetchEventNames } from "@/lib/api";
import { truncateAddress, EXPLORER_URLS } from "@arcana/shared";
import { ErrorState } from "@/components/ErrorState";

interface Transaction {
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string | null;
  gasUsed: string;
  gasPrice: string;
  status: number;
  isStylus: boolean;
  timestamp: string;
  methodId: string | null;
}

interface Block {
  blockNumber: number;
  blockHash: string;
  timestamp: string;
  gasUsed: string;
  gasLimit: string;
  txCount: number;
}

interface ContractEvent {
  id: number;
  dappId: string;
  eventName: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  eventData: Record<string, unknown>;
  timestamp: string;
}

interface EventNameCount {
  eventName: string;
  count: number;
}

const PAGE_SIZE = 50;

export default function ExplorerPage() {
  const [tab, setTab] = useState<"transactions" | "blocks" | "events">("transactions");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [eventNames, setEventNames] = useState<EventNameCount[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "stylus" | "reverted">("all");

  // Pagination
  const [txPage, setTxPage] = useState(0);
  const [blockPage, setBlockPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "transactions") {
        const res = await fetchTransactions({ limit: PAGE_SIZE, offset: txPage * PAGE_SIZE });
        setTransactions(res.data);
      } else if (tab === "blocks") {
        const res = await fetchRecentBlocks(PAGE_SIZE);
        setBlocks(res.data);
      } else {
        const [evRes, namesRes] = await Promise.all([
          fetchEvents({
            limit: PAGE_SIZE,
            offset: eventPage * PAGE_SIZE,
            eventName: eventFilter !== "all" ? eventFilter : undefined,
          }),
          fetchEventNames(),
        ]);
        setEvents(evRes.data);
        setEventNames(namesRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [tab, eventFilter, txPage, blockPage, eventPage]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTxs = transactions.filter((tx) => {
    if (filter === "stylus") return tx.isStylus;
    if (filter === "reverted") return tx.status === 0;
    return true;
  });

  // Reset page when changing tabs
  const switchTab = (t: typeof tab) => {
    setTab(t);
    setTxPage(0);
    setBlockPage(0);
    setEventPage(0);
  };

  function PaginationControls({ page, setPage, dataLen }: { page: number; setPage: (p: number) => void; dataLen: number }) {
    return (
      <div className="flex items-center justify-between mt-4 px-3">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1f2e] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-slate-500">
          Page {page + 1} {dataLen < PAGE_SIZE && page > 0 ? "(last)" : ""}
        </span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={dataLen < PAGE_SIZE}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1f2e] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Explorer</h2>
        <p className="text-sm text-slate-400 mt-1">
          Browse indexed blocks and transactions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-[#2a3040] pb-3 flex-wrap">
        <button
          onClick={() => switchTab("transactions")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            tab === "transactions"
              ? "text-white border-arcana-500"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => switchTab("blocks")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            tab === "blocks"
              ? "text-white border-arcana-500"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          Blocks
        </button>
        <button
          onClick={() => switchTab("events")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            tab === "events"
              ? "text-white border-arcana-500"
              : "text-slate-400 border-transparent hover:text-white"
          }`}
        >
          Events
        </button>

        {tab === "events" && (
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              onClick={() => { setEventFilter("all"); setEventPage(0); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                eventFilter === "all"
                  ? "bg-arcana-600 text-white"
                  : "bg-[#1a1f2e] text-slate-400"
              }`}
            >
              All
            </button>
            {eventNames.slice(0, 5).map((en) => (
              <button
                key={en.eventName}
                onClick={() => { setEventFilter(en.eventName); setEventPage(0); }}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  eventFilter === en.eventName
                    ? "bg-arcana-600 text-white"
                    : "bg-[#1a1f2e] text-slate-400"
                }`}
              >
                {en.eventName} ({en.count})
              </button>
            ))}
          </div>
        )}

        {tab === "transactions" && (
          <div className="ml-auto flex gap-2">
            {(["all", "stylus", "reverted"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  filter === f
                    ? "bg-arcana-600 text-white"
                    : "bg-[#1a1f2e] text-slate-400"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "stylus"
                    ? "Stylus Only"
                    : "Reverted"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-800 rounded"></div>
          ))}
        </div>
      ) : tab === "transactions" ? (
        <div className="card overflow-hidden">
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
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map((tx) => (
                    <tr key={tx.txHash} className="border-b border-[#2a3040]/50 hover:bg-[#1a1f2e]/50">
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
                          <span className="badge badge-success">OK</span>
                        ) : (
                          <span className="badge badge-error">Fail</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {tx.isStylus ? (
                          <span className="badge badge-stylus">Stylus</span>
                        ) : (
                          <span className="badge bg-slate-700/50 text-slate-400">EVM</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls page={txPage} setPage={setTxPage} dataLen={transactions.length} />
        </div>
      ) : tab === "blocks" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a3040]">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Block</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Hash</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Txs</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Gas Used</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Gas Limit</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {blocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No blocks indexed yet
                    </td>
                  </tr>
                ) : (
                  blocks.map((block) => (
                    <tr key={block.blockNumber} className="border-b border-[#2a3040]/50 hover:bg-[#1a1f2e]/50">
                      <td className="py-2.5 px-3 text-arcana-400 font-mono">{block.blockNumber}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{truncateAddress(block.blockHash, 8)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{block.txCount}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                        {parseInt(block.gasUsed).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {parseInt(block.gasLimit).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                        {new Date(block.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls page={blockPage} setPage={setBlockPage} dataLen={blocks.length} />
        </div>
      ) : tab === "events" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a3040]">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Event</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Tx Hash</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Block</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Contract</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Log #</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No events found. Register a dApp and its contract addresses to start collecting events.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={`${ev.txHash}-${ev.logIndex}`} className="border-b border-[#2a3040]/50 hover:bg-[#1a1f2e]/50">
                      <td className="py-2.5 px-3">
                        <span className="badge badge-stylus">{ev.eventName}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <a
                          href={`${EXPLORER_URLS[42161]}/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-arcana-400 hover:text-arcana-300 font-mono"
                        >
                          {truncateAddress(ev.txHash, 6)}
                        </a>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">{ev.blockNumber}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {ev.eventData.address
                          ? truncateAddress(ev.eventData.address as string)
                          : "\u2014"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{ev.logIndex}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls page={eventPage} setPage={setEventPage} dataLen={events.length} />
        </div>
      ) : null}
    </div>
  );
}
