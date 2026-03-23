import type { Database } from "@arcana/db";
import {
  getEnabledAlertRules,
  getLastAlertForRule,
  insertAlertEvent,
  getLatestAggregate,
} from "@arcana/db";
import type { AlertMetric } from "@arcana/shared";
import type Redis from "ioredis";
import { REDIS_CHANNELS } from "@arcana/shared";

export class AlertEvaluator {
  constructor(
    private db: Database,
    private redis: Redis,
  ) {}

  /** Evaluate all enabled alert rules against latest aggregates */
  async evaluate(): Promise<void> {
    const rules = await getEnabledAlertRules(this.db);

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (err) {
        console.error(`[alert] Error evaluating rule ${rule.id}:`, err);
      }
    }
  }

  private async evaluateRule(rule: {
    id: string;
    dappId: string | null;
    metric: string;
    condition: string;
    threshold: string;
    window: string;
    cooldownMinutes: number;
  }): Promise<void> {
    // Check cooldown
    const lastAlert = await getLastAlertForRule(this.db, rule.id);
    if (lastAlert) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - new Date(lastAlert.triggeredAt).getTime();
      if (elapsed < cooldownMs) return;
    }

    // Get latest aggregate for this rule's window
    const aggregate = await getLatestAggregate(this.db, {
      dappId: rule.dappId,
      window: rule.window,
    });

    if (!aggregate) return;

    // Extract the metric value
    const metricValue = this.extractMetric(
      rule.metric as AlertMetric,
      aggregate,
    );
    if (metricValue === null) return;

    const threshold = parseFloat(rule.threshold);

    // Check condition
    const triggered =
      rule.condition === "above"
        ? metricValue > threshold
        : metricValue < threshold;

    if (triggered) {
      const event = await insertAlertEvent(this.db, {
        ruleId: rule.id,
        metricValue: metricValue.toString(),
        thresholdValue: rule.threshold,
      });

      // Publish to Redis for real-time notification
      const payload = JSON.stringify({
        type: REDIS_CHANNELS.ALERTS,
        dappId: rule.dappId,
        data: {
          alertId: event.id,
          ruleId: rule.id,
          metric: rule.metric,
          condition: rule.condition,
          metricValue,
          threshold,
        },
        timestamp: Date.now(),
      });

      await this.redis.publish(REDIS_CHANNELS.ALERTS, payload);

      console.log(
        `[alert] Rule ${rule.id} triggered: ${rule.metric} ${rule.condition} ${threshold} (actual: ${metricValue})`,
      );
    }
  }

  private extractMetric(
    metric: AlertMetric,
    aggregate: {
      avgGasUsed: string | null;
      errorRate: string | null;
      txCount: number;
      avgTxSpeed: string | null;
      stylusTxCount: number;
    },
  ): number | null {
    switch (metric) {
      case "gas_usage":
        return aggregate.avgGasUsed ? parseFloat(aggregate.avgGasUsed) : null;
      case "error_rate":
        return aggregate.errorRate ? parseFloat(aggregate.errorRate) : null;
      case "tx_throughput":
        return aggregate.txCount;
      case "tx_speed":
        return aggregate.avgTxSpeed ? parseFloat(aggregate.avgTxSpeed) : null;
      case "stylus_ratio":
        return aggregate.txCount > 0
          ? aggregate.stylusTxCount / aggregate.txCount
          : null;
      default:
        return null;
    }
  }
}
