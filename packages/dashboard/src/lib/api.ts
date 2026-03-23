const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ── dApps ──
export async function fetchDapps() {
  return fetchApi<{ success: boolean; data: DApp[] }>("/api/dapps");
}

export async function fetchDapp(id: string) {
  return fetchApi<{ success: boolean; data: DApp }>(`/api/dapps/${id}`);
}

export async function createDapp(body: {
  name: string;
  contractAddresses: string[];
}) {
  const res = await fetch(`${API_URL}/api/dapps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Metrics ──
export async function fetchGlobalMetrics(range = "24h") {
  return fetchApi<{ success: boolean; data: MetricAggregate[] }>(
    `/api/metrics/global?range=${range}`,
  );
}

export async function fetchDappMetrics(dappId: string, range = "24h") {
  return fetchApi<{ success: boolean; data: MetricAggregate[] }>(
    `/api/dapps/${dappId}/metrics?range=${range}`,
  );
}

export async function fetchLatestMetrics(dappId?: string) {
  const query = dappId ? `?dappId=${dappId}` : "";
  return fetchApi<{ success: boolean; data: MetricAggregate | null }>(
    `/api/metrics/latest${query}`,
  );
}

// ── Transactions ──
export async function fetchTransactions(opts?: {
  dappId?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.dappId) params.set("dappId", opts.dappId);
  if (opts?.limit) params.set("limit", opts.limit.toString());
  if (opts?.offset) params.set("offset", opts.offset.toString());
  return fetchApi<{ success: boolean; data: Transaction[] }>(
    `/api/transactions?${params}`,
  );
}

export async function fetchStylusStats() {
  return fetchApi<{
    success: boolean;
    data: { total: number; last24h: number; last1h: number };
  }>("/api/transactions/stylus/stats");
}

// ── Blocks ──
export async function fetchRecentBlocks(limit = 20) {
  return fetchApi<{ success: boolean; data: Block[] }>(
    `/api/blocks?limit=${limit}`,
  );
}

// ── Alerts ──
export async function fetchAlertRules() {
  return fetchApi<{ success: boolean; data: AlertRule[] }>("/api/alerts");
}

export async function fetchAlertHistory(limit = 50) {
  return fetchApi<{ success: boolean; data: AlertEvent[] }>(
    `/api/alerts/history?limit=${limit}`,
  );
}

export async function createAlertRule(body: {
  metric: string;
  condition: string;
  threshold: number;
  window: string;
  dappId?: string;
}) {
  const res = await fetch(`${API_URL}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteAlertRule(id: string) {
  const res = await fetch(`${API_URL}/api/alerts/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

// ── Events ──
export async function fetchEvents(opts?: {
  dappId?: string;
  eventName?: string;
  txHash?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.dappId) params.set("dappId", opts.dappId);
  if (opts?.eventName) params.set("eventName", opts.eventName);
  if (opts?.txHash) params.set("txHash", opts.txHash);
  if (opts?.limit) params.set("limit", opts.limit.toString());
  if (opts?.offset) params.set("offset", opts.offset.toString());
  return fetchApi<{ success: boolean; data: ContractEvent[] }>(
    `/api/events?${params}`,
  );
}

export async function fetchEventNames(dappId?: string) {
  const params = dappId ? `?dappId=${dappId}` : "";
  return fetchApi<{
    success: boolean;
    data: Array<{ eventName: string; count: number }>;
  }>(`/api/events/names${params}`);
}

export async function fetchEventStats() {
  return fetchApi<{
    success: boolean;
    data: { total: number; last24h: number; last1h: number };
  }>("/api/events/stats");
}

// ── Stylus Analytics ──
export async function fetchGasComparison(range = "24h") {
  return fetchApi<{
    success: boolean;
    data: GasComparison;
  }>(`/api/stylus/gas-comparison?range=${range}`);
}

export async function fetchGasComparisonTimeSeries(range = "24h") {
  return fetchApi<{
    success: boolean;
    data: GasComparisonPoint[];
  }>(`/api/stylus/gas-comparison/timeseries?range=${range}`);
}

export async function fetchTopStylusContracts(range = "24h", limit = 20) {
  return fetchApi<{
    success: boolean;
    data: StylusContract[];
  }>(`/api/stylus/contracts?range=${range}&limit=${limit}`);
}

export async function fetchStylusAdoption(range = "24h") {
  return fetchApi<{
    success: boolean;
    data: StylusAdoption;
  }>(`/api/stylus/adoption?range=${range}`);
}

// ── Search ──
export async function fetchSearch(query: string) {
  return fetchApi<{
    success: boolean;
    data: {
      type: "transaction" | "block" | "address" | "none";
      result: unknown;
    };
  }>(`/api/search?q=${encodeURIComponent(query)}`);
}

// ── Types ──
interface DApp {
  id: string;
  name: string;
  contractAddresses: string[];
  chainId: number;
  createdAt: string;
}

interface MetricAggregate {
  id: number;
  dappId: string | null;
  window: string;
  windowStart: string;
  avgGasUsed: string;
  avgGasPrice: string;
  txCount: number;
  errorCount: number;
  errorRate: string;
  avgTxSpeed: string;
  uniqueAddresses: number;
  stylusTxCount: number;
}

interface Transaction {
  txHash: string;
  blockNumber: number;
  dappId: string | null;
  fromAddress: string;
  toAddress: string | null;
  gasUsed: string;
  gasPrice: string;
  status: number;
  txType: number;
  timestamp: string;
  inputSize: number;
  isStylus: boolean;
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

interface AlertRule {
  id: string;
  dappId: string | null;
  metric: string;
  condition: string;
  threshold: string;
  window: string;
  cooldownMinutes: number;
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

interface GasComparison {
  stylusAvgGas: number;
  evmAvgGas: number;
  stylusTotalGas: string;
  evmTotalGas: string;
  stylusCount: number;
  evmCount: number;
  stylusAvgGasPrice: number;
  evmAvgGasPrice: number;
  gasSavingsPercent: string;
}

interface GasComparisonPoint {
  time: string;
  stylusAvgGas: number;
  evmAvgGas: number;
  stylusCount: number;
  evmCount: number;
}

interface StylusContract {
  address: string | null;
  txCount: number;
  avgGas: string;
  totalGas: string;
  errorCount: number;
  uniqueCallers: number;
  firstSeen: string;
  lastSeen: string;
}

interface StylusAdoption {
  totalTxs: number;
  stylusTxs: number;
  evmTxs: number;
  stylusRatio: string;
  stylusContracts: number;
  evmContracts: number;
  stylusErrorRate: string;
  evmErrorRate: string;
}
