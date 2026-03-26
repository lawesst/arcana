"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchAlertRules,
  fetchAlertHistory,
  createAlertRule,
  deleteAlertRule,
  updateAlertRule,
  fetchDapps,
} from "@/lib/api";
import { ErrorState } from "@/components/ErrorState";

interface DApp {
  id: string;
  name: string;
}

interface AlertRule {
  id: string;
  dappId: string | null;
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
  {
    value: "gas_usage",
    label: "Gas Usage",
    placeholder: "1000000",
    hint: "Average gas per transaction.",
  },
  {
    value: "error_rate",
    label: "Error Rate",
    placeholder: "5",
    hint: "Enter a percentage like 5 for 5%.",
  },
  {
    value: "tx_throughput",
    label: "Tx Throughput",
    placeholder: "500",
    hint: "Transactions observed in the selected window.",
  },
  {
    value: "tx_speed",
    label: "Tx Speed",
    placeholder: "12",
    hint: "Average transaction confirmation speed.",
  },
  {
    value: "stylus_ratio",
    label: "Stylus Ratio",
    placeholder: "20",
    hint: "Enter a percentage like 20 for 20% Stylus share.",
  },
] as const;

const PERCENT_METRICS = new Set(["error_rate", "stylus_ratio"]);

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [dapps, setDapps] = useState<DApp[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);

  const [selectedDappId, setSelectedDappId] = useState("");
  const [metric, setMetric] = useState("gas_usage");
  const [condition, setCondition] = useState("above");
  const [threshold, setThreshold] = useState("");
  const [window, setWindow] = useState("5m");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, historyRes, dappsRes] = await Promise.all([
        fetchAlertRules(),
        fetchAlertHistory(),
        fetchDapps(),
      ]);
      setRules(rulesRes.data);
      setHistory(historyRes.data);
      setDapps(dappsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const thresholdValue = Number.parseFloat(threshold);
    if (!Number.isFinite(thresholdValue)) {
      setActionError("Enter a valid numeric threshold.");
      return;
    }

    setSubmitting(true);

    try {
      const normalizedThreshold = PERCENT_METRICS.has(metric)
        ? thresholdValue / 100
        : thresholdValue;

      await createAlertRule({
        dappId: selectedDappId || undefined,
        metric,
        condition,
        threshold: normalizedThreshold,
        window,
      });

      setThreshold("");
      setSelectedDappId("");
      setShowForm(false);
      setActionSuccess("Alert rule created.");
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create alert rule",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setPendingRuleId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      await deleteAlertRule(id);
      setActionSuccess("Alert rule deleted.");
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete alert rule",
      );
    } finally {
      setPendingRuleId(null);
    }
  }

  async function handleToggle(rule: AlertRule) {
    setPendingRuleId(rule.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      await updateAlertRule(rule.id, { enabled: !rule.enabled });
      setActionSuccess(
        rule.enabled ? "Alert rule disabled." : "Alert rule enabled.",
      );
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update alert rule",
      );
    } finally {
      setPendingRuleId(null);
    }
  }

  const dappNameById = new Map(dapps.map((dapp) => [dapp.id, dapp.name]));
  const selectedMetric = METRICS.find((item) => item.value === metric) ?? METRICS[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Alerts</h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure thresholds to detect performance regressions and anomalies
          </p>
        </div>
        <button
          data-testid="toggle-alert-form"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700 transition-colors"
        >
          {showForm ? "Close Form" : "+ Create Rule"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Scope
              </label>
              <select
                data-testid="alert-scope-select"
                value={selectedDappId}
                onChange={(e) => setSelectedDappId(e.target.value)}
                disabled={submitting}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Network-wide</option>
                {dapps.map((dapp) => (
                  <option key={dapp.id} value={dapp.id}>
                    {dapp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Metric
              </label>
              <select
                data-testid="alert-metric-select"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                disabled={submitting}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white"
              >
                {METRICS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Condition
              </label>
              <select
                data-testid="alert-condition-select"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                disabled={submitting}
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
                data-testid="alert-threshold-input"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder={selectedMetric.placeholder}
                disabled={submitting}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
              <p className="mt-1 text-xs text-slate-500">
                {selectedMetric.hint}
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Window
              </label>
              <select
                data-testid="alert-window-select"
                value={window}
                onChange={(e) => setWindow(e.target.value)}
                disabled={submitting}
                className="w-full bg-[#0a0e1a] border border-[#2a3040] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="5m">5 minutes</option>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
              </select>
            </div>
          </div>

          {actionError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {actionError}
            </div>
          )}

          <button
            data-testid="submit-alert-form"
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-arcana-600 text-white rounded-lg text-sm font-medium hover:bg-arcana-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Alert Rule"}
          </button>
        </form>
      )}

      {actionSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {actionSuccess}
        </div>
      )}

      {!showForm && actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <>
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
                    data-testid={`alert-rule-${rule.id}`}
                    className="card flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          rule.enabled ? "bg-emerald-500" : "bg-slate-600"
                        }`}
                      ></span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">
                            {getMetricLabel(rule.metric)}
                          </span>
                          <span className="text-slate-400">
                            {rule.condition}
                          </span>
                          <span className="text-arcana-400 font-mono">
                            {formatAlertNumber(rule.metric, rule.threshold)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="badge bg-slate-700/50 text-slate-300">
                            {rule.window}
                          </span>
                          <span className="badge bg-[#1a1f2e] text-slate-300">
                            {rule.dappId
                              ? dappNameById.get(rule.dappId) ?? "Selected dApp"
                              : "Network-wide"}
                          </span>
                          <span className="text-slate-500">
                            {rule.enabled ? "Enabled" : "Paused"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        data-testid={`alert-toggle-${rule.id}`}
                        onClick={() => handleToggle(rule)}
                        disabled={pendingRuleId === rule.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1f2e] text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pendingRuleId === rule.id
                          ? "Saving..."
                          : rule.enabled
                            ? "Disable"
                            : "Enable"}
                      </button>
                      <button
                        data-testid={`alert-delete-${rule.id}`}
                        onClick={() => handleDelete(rule.id)}
                        disabled={pendingRuleId === rule.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-3">
              Recent Alerts
            </h3>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-800 rounded-xl"></div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-slate-400">No alerts triggered yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((event) => {
                  const rule = rules.find((item) => item.id === event.ruleId);
                  const metricKey = rule?.metric ?? "tx_throughput";

                  return (
                    <div
                      key={event.id}
                      className="card flex items-center justify-between gap-4 py-3 flex-wrap"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            event.resolvedAt ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        ></span>
                        <div className="space-y-1">
                          <div className="text-sm text-white">
                            {rule
                              ? `${getMetricLabel(rule.metric)} ${rule.condition} ${formatAlertNumber(rule.metric, rule.threshold)}`
                              : `Rule ${event.ruleId.slice(0, 8)}...`}
                          </div>
                          <div className="text-sm text-slate-400">
                            Value:{" "}
                            <span className="font-mono text-red-300">
                              {formatAlertNumber(metricKey, event.metricValue)}
                            </span>
                            {" / "}
                            Threshold:{" "}
                            <span className="font-mono">
                              {formatAlertNumber(metricKey, event.thresholdValue)}
                            </span>
                          </div>
                        </div>
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
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getMetricLabel(metric: string) {
  return METRICS.find((item) => item.value === metric)?.label ?? metric;
}

function formatAlertNumber(metric: string, value: string) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return value;

  if (PERCENT_METRICS.has(metric)) {
    return `${(numeric * 100).toFixed(2)}%`;
  }

  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  return numeric.toFixed(numeric % 1 === 0 ? 0 : 2);
}
