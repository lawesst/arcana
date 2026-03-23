import type { App } from "../types";
import {
  getAlertRules,
  createAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  getAlertHistory,
} from "@arcana/db";

export function registerAlertRoutes(app: App) {
  // List alert rules
  app.get<{
    Querystring: { dappId?: string };
  }>("/api/alerts", async (req) => {
    const rules = await getAlertRules(app.db, req.query.dappId);
    return { success: true, data: rules };
  });

  // Create alert rule
  app.post<{
    Body: {
      dappId?: string | null;
      metric: string;
      condition: string;
      threshold: number;
      window: string;
      cooldownMinutes?: number;
    };
  }>("/api/alerts", async (req, reply) => {
    const { metric, condition, threshold, window } = req.body;

    if (!metric || !condition || threshold === undefined || !window) {
      return reply
        .status(400)
        .send({ success: false, error: "metric, condition, threshold, and window are required" });
    }

    const rule = await createAlertRule(app.db, {
      ...req.body,
      threshold: threshold.toString(),
    });

    return reply.status(201).send({ success: true, data: rule });
  });

  // Toggle alert rule
  app.patch<{
    Params: { id: string };
    Body: { enabled: boolean };
  }>("/api/alerts/:id", async (req) => {
    await toggleAlertRule(app.db, req.params.id, req.body.enabled);
    return { success: true };
  });

  // Delete alert rule
  app.delete<{ Params: { id: string } }>(
    "/api/alerts/:id",
    async (req) => {
      await deleteAlertRule(app.db, req.params.id);
      return { success: true };
    },
  );

  // Get alert history
  app.get<{
    Querystring: { ruleId?: string; limit?: number };
  }>("/api/alerts/history", async (req) => {
    const history = await getAlertHistory(app.db, {
      ruleId: req.query.ruleId,
      limit: req.query.limit,
    });
    return { success: true, data: history };
  });
}
