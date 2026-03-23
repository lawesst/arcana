"use client";

import { useState, useEffect } from "react";
import {
  fetchAlertRules,
  fetchAlertHistory,
  createAlertRule,
  deleteAlertRule,
} from "@/lib/api";

interface AlertRule {
  id: string;
  metric: string;
  condition: string;
  threshold: string;
  window: string;
  enabled: boolean;
}

interface AlertEvent {
  id: number;
  ruleId: string;
  triggeredAt: string;
  metricValue: string;
  thresholdValue: string;
  resolvedAt: string | null;
}

const METRICS = [
  { value: "gas_usage", label: "Gas Usage" },
  { value: "error_rate", label: "Error Rate" },
  { value: "tx_throughput", label: "Tx Throughput" },
  { value: "tx_speed", label: "Tx Speed" },
  { value: "stylus_ratio", label: "Stylus Ratio" },
];

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [metric, setMetric] = useState("gas_usage");
  const [condition, setCondition] = useState("above");
  const [threshold, setThreshold] = useState("");
  const [window, setWindow] = useState("5m");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [rulesRes, historyRes] = await Promise.all([
        fetchAlertRules(),
        fetchAlertHistory(),
      ]);
      setRules(rulesRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!threshold) return;

    await createAlertRule({
      metric,
      condition,
      threshold: parseFloat(threshold),
      window,
    });

    setThreshold("");
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: string) {
    await deleteAlertRule(id);
    loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Alerts</h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure thresholds to get notified about anomalies
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700 transition-colors"
        >
          + Create Rule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Metric
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white"
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Threshold
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="100000"
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Window
              </label>
              <select
                value={window}
                onChange={(e) => setWindow(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="5m">5 minutes</option>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700"
          >
            Create Alert Rule
          </button>
        </form>
      )}

      {/* Alert Rules */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Active Rules</h3>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 rounded-xl"></div>
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-slate-400">No alert rules configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="card flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      rule.enabled ? "bg-emerald-500" : "bg-slate-600"
                    }`}
                  ></span>
                  <div>
                    <span className="text-white font-medium">
                      {METRICS.find((m) => m.value === rule.metric)?.label}
                    </span>
                    <span className="text-slate-400 mx-2">
                      {rule.condition}
                    </span>
                    <span className="text-arcana-400 font-mono">
                      {rule.threshold}
                    </span>
                  </div>
                  <span className="badge bg-slate-700/50 text-slate-400">
                    {rule.window}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">
          Recent Alerts
        </h3>
        {history.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-slate-400">No alerts triggered yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((event) => (
              <div key={event.id} className="card flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-sm text-white">
                    Rule {event.ruleId.slice(0, 8)}...
                  </span>
                  <span className="text-sm text-slate-400">
                    Value: <span className="text-red-400 font-mono">{parseFloat(event.metricValue).toFixed(2)}</span>
                    {" / "}
                    Threshold: <span className="font-mono">{parseFloat(event.thresholdValue).toFixed(2)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {event.resolvedAt ? (
                    <span className="badge badge-success">Resolved</span>
                  ) : (
                    <span className="badge badge-error">Active</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {new Date(event.triggeredAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
