import postgres from "postgres";

async function main() {
  const sql = postgres("postgresql://arcana:arcana_dev@localhost:5432/arcana");

  const tables = [
    "contract_events",
    "alert_events",
    "alert_rules",
    "aggregates",
    "transactions",
    "blocks",
    "dapp_contracts",
    "dapps",
  ];

  for (const t of tables) {
    try {
      await sql.unsafe(`DELETE FROM ${t}`);
    } catch {
      // table may not exist
    }
  }
  console.log("All tables cleared");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
