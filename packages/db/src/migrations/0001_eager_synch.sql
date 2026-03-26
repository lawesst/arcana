DROP INDEX "idx_agg_dapp_window_start";--> statement-breakpoint
DELETE FROM "metric_aggregates" AS old_rows
USING "metric_aggregates" AS new_rows
WHERE old_rows.id < new_rows.id
  AND old_rows.dapp_id IS NULL
  AND new_rows.dapp_id IS NULL
  AND old_rows."window" = new_rows."window"
  AND old_rows.window_start = new_rows.window_start;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agg_global_window_start" ON "metric_aggregates" USING btree ("window","window_start") WHERE "metric_aggregates"."dapp_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agg_dapp_window_start" ON "metric_aggregates" USING btree ("dapp_id","window","window_start") WHERE "metric_aggregates"."dapp_id" is not null;
