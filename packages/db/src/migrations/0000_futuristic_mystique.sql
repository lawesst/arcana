CREATE TABLE "dapps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"contract_addresses" jsonb NOT NULL,
	"abi" jsonb,
	"chain_id" integer DEFAULT 42161 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"block_number" bigint PRIMARY KEY NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"gas_used" bigint NOT NULL,
	"gas_limit" bigint NOT NULL,
	"tx_count" integer NOT NULL,
	"base_fee" bigint
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"tx_hash" varchar(66) PRIMARY KEY NOT NULL,
	"block_number" bigint NOT NULL,
	"dapp_id" uuid,
	"from_address" varchar(42) NOT NULL,
	"to_address" varchar(42),
	"gas_used" bigint NOT NULL,
	"gas_price" bigint NOT NULL,
	"status" smallint NOT NULL,
	"tx_type" smallint NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"input_size" integer NOT NULL,
	"is_stylus" boolean DEFAULT false NOT NULL,
	"method_id" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "contract_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dapp_id" uuid NOT NULL,
	"event_name" varchar(255) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"block_number" bigint NOT NULL,
	"log_index" integer NOT NULL,
	"event_data" jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_aggregates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dapp_id" uuid,
	"window" varchar(4) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"avg_gas_used" numeric NOT NULL,
	"avg_gas_price" numeric NOT NULL,
	"tx_count" integer NOT NULL,
	"error_count" integer NOT NULL,
	"error_rate" numeric NOT NULL,
	"avg_tx_speed" numeric NOT NULL,
	"unique_addresses" integer NOT NULL,
	"stylus_tx_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rule_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metric_value" numeric NOT NULL,
	"threshold_value" numeric NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dapp_id" uuid,
	"metric" varchar(50) NOT NULL,
	"condition" varchar(10) NOT NULL,
	"threshold" numeric NOT NULL,
	"window" varchar(4) NOT NULL,
	"cooldown_minutes" integer DEFAULT 15 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_dapp_id_dapps_id_fk" FOREIGN KEY ("dapp_id") REFERENCES "public"."dapps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_dapp_id_dapps_id_fk" FOREIGN KEY ("dapp_id") REFERENCES "public"."dapps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_aggregates" ADD CONSTRAINT "metric_aggregates_dapp_id_dapps_id_fk" FOREIGN KEY ("dapp_id") REFERENCES "public"."dapps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_dapp_id_dapps_id_fk" FOREIGN KEY ("dapp_id") REFERENCES "public"."dapps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tx_dapp_timestamp" ON "transactions" USING btree ("dapp_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_tx_block_number" ON "transactions" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "idx_tx_timestamp" ON "transactions" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_tx_is_stylus" ON "transactions" USING btree ("is_stylus");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_tx_log" ON "contract_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "idx_event_dapp_timestamp" ON "contract_events" USING btree ("dapp_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agg_dapp_window_start" ON "metric_aggregates" USING btree ("dapp_id","window","window_start");--> statement-breakpoint
CREATE INDEX "idx_agg_window_start" ON "metric_aggregates" USING btree ("window","window_start");--> statement-breakpoint
CREATE INDEX "idx_alert_history_rule" ON "alert_history" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_triggered" ON "alert_history" USING btree ("triggered_at");