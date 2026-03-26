// ── Core domain types for Arcana ──

/** Supported Arbitrum networks */
export type ChainId = 42161 | 421614; // Arbitrum One | Arbitrum Sepolia

/** A monitored dApp */
export interface DApp {
  id: string;
  name: string;
  contractAddresses: string[];
  chainId: ChainId;
  createdAt: Date;
}

/** Block-level metrics */
export interface BlockMetrics {
  blockNumber: number;
  blockHash: string;
  timestamp: Date;
  gasUsed: bigint;
  gasLimit: bigint;
  txCount: number;
  baseFee: bigint | null;
}

/** Per-transaction data */
export interface TransactionData {
  txHash: string;
  blockNumber: number;
  dappId: string | null;
  fromAddress: string;
  toAddress: string | null;
  gasUsed: bigint;
  gasPrice: bigint;
  status: 0 | 1;
  txType: number;
  timestamp: Date;
  inputSize: number;
  isStylus: boolean;
  methodId: string | null;
}

/** Contract event from a monitored dApp */
export interface ContractEvent {
  id: number;
  dappId: string;
  eventName: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  eventData: Record<string, unknown>;
  timestamp: Date;
}

/** Time-window aggregated metrics */
export type AggregateWindow = "5m" | "1h" | "24h";

export interface MetricAggregate {
  id: number;
  dappId: string | null;
  window: AggregateWindow;
  windowStart: Date;
  avgGasUsed: number;
  avgGasPrice: number;
  txCount: number;
  errorCount: number;
  errorRate: number;
  avgTxSpeed: number;
  uniqueAddresses: number;
  stylusTxCount: number;
}

/** Alert rule configuration */
export type AlertMetric =
  | "gas_usage"
  | "error_rate"
  | "tx_throughput"
  | "tx_speed"
  | "stylus_ratio";

export type AlertCondition = "above" | "below";

export interface AlertRule {
  id: string;
  dappId: string | null;
  metric: AlertMetric;
  condition: AlertCondition;
  threshold: number;
  window: AggregateWindow;
  cooldownMinutes: number;
  enabled: boolean;
  createdAt: Date;
}

export interface AlertEvent {
  id: number;
  ruleId: string;
  triggeredAt: Date;
  metricValue: number;
  thresholdValue: number;
  resolvedAt: Date | null;
}

/** Historical backfill state for a monitored dApp */
export type BackfillState =
  | "queued"
  | "scanning"
  | "syncing"
  | "completed"
  | "failed";

export interface BackfillStatus {
  dappId: string;
  state: BackfillState;
  startedAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  totalTransactions: number | null;
  processedTransactions: number;
  indexedTransactions: number;
  indexedEvents: number;
  message: string | null;
  error: string | null;
}

/** WebSocket message types for real-time updates */
export type WsMessageType =
  | "metric_update"
  | "new_block"
  | "new_transaction"
  | "alert_triggered"
  | "alert_resolved";

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  dappId: string | null;
  data: T;
  timestamp: number;
}

/** API response wrappers */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  offset: number;
  limit: number;
}

/** Time range query parameter */
export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";
