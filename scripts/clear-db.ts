import postgres from "postgres";

async function main() {
  const sql = postgres("postgresql://arcana:arcana_dev@localhost:5432/arcana");

  await sql.unsafe(
    "TRUNCATE contract_events, alert_history, alert_rules, metric_aggregates, transactions, blocks, dapps CASCADE",
  );

  const count = await sql.unsafe("SELECT count(*) FROM blocks");
  console.log("Blocks remaining:", count[0].count);
  console.log("All tables cleared");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
