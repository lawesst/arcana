import { eq } from "drizzle-orm";
import { loadEnv } from "@arcana/shared/src/config";
import { createDb } from "../index";
import { dapps } from "../schema";

const MONITORED_DAPPS = [
  {
    name: "Infinite Rainbows",
    contractAddresses: ["0x78072889ee4d7fe1a100c25296aabbea32e92bea"],
    chainId: 42161,
  },
  {
    name: "StylusPencil",
    contractAddresses: ["0xb9ff17bc84720734fd8b0c88b2905008a71091d0"],
    chainId: 42161,
  },
] as const;

async function main() {
  const ifEmpty = process.argv.includes("--if-empty");
  const env = loadEnv();
  const { db, client } = createDb(env.DATABASE_URL);

  try {
    const existing = await db.select().from(dapps);
    const activeCount = existing.filter((dapp) => dapp.deletedAt === null).length;

    if (ifEmpty && activeCount > 0) {
      console.log(
        `[arcana:seed] Skipping monitored dApp seed because ${activeCount} active dApp(s) already exist`,
      );
      return;
    }

    let created = 0;
    let restored = 0;
    let updated = 0;
    let unchanged = 0;

    for (const monitored of MONITORED_DAPPS) {
      const normalizedAddresses = normalizeAddresses(monitored.contractAddresses);
      const matchingRecord = existing.find((dapp) =>
        dapp.contractAddresses.some((address) =>
          normalizedAddresses.includes(address.toLowerCase()),
        ),
      );

      if (!matchingRecord) {
        const [inserted] = await db
          .insert(dapps)
          .values({
            name: monitored.name,
            contractAddresses: normalizedAddresses,
            abi: null,
            chainId: monitored.chainId,
            deletedAt: null,
          })
          .returning();

        existing.push(inserted);
        created += 1;
        continue;
      }

      const currentAddresses = normalizeAddresses(matchingRecord.contractAddresses);
      const sameAddresses = arraysEqual(currentAddresses, normalizedAddresses);
      const needsRestore = matchingRecord.deletedAt !== null;
      const needsRename = matchingRecord.name !== monitored.name;
      const needsAddressUpdate = !sameAddresses;
      const needsChainUpdate = matchingRecord.chainId !== monitored.chainId;

      if (!needsRestore && !needsRename && !needsAddressUpdate && !needsChainUpdate) {
        unchanged += 1;
        continue;
      }

      const [nextRecord] = await db
        .update(dapps)
        .set({
          name: monitored.name,
          contractAddresses: normalizedAddresses,
          chainId: monitored.chainId,
          deletedAt: null,
        })
        .where(eq(dapps.id, matchingRecord.id))
        .returning();

      const index = existing.findIndex((dapp) => dapp.id === matchingRecord.id);
      if (index >= 0) {
        existing[index] = nextRecord;
      }

      if (needsRestore) {
        restored += 1;
      }
      if (needsRename || needsAddressUpdate || needsChainUpdate) {
        updated += 1;
      }
    }

    console.log(
      `[arcana:seed] Monitored dApp seed complete: created=${created}, restored=${restored}, updated=${updated}, unchanged=${unchanged}`,
    );
  } finally {
    await client.end();
  }
}

function normalizeAddresses(addresses: readonly string[]) {
  return [...new Set(addresses.map((address) => address.toLowerCase()))].sort();
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

main().catch((error) => {
  console.error("[arcana:seed] Failed to seed monitored dApps:", error);
  process.exit(1);
});
