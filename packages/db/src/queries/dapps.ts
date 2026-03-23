import { eq } from "drizzle-orm";
import { dapps } from "../schema/dapps";
import type { Database } from "../index";

export async function getAllDapps(db: Database) {
  return db.select().from(dapps).orderBy(dapps.createdAt);
}

export async function getDappById(db: Database, id: string) {
  const results = await db.select().from(dapps).where(eq(dapps.id, id));
  return results[0] ?? null;
}

export async function createDapp(
  db: Database,
  data: {
    name: string;
    contractAddresses: string[];
    abi?: unknown[];
    chainId?: number;
  },
) {
  const results = await db
    .insert(dapps)
    .values({
      name: data.name,
      contractAddresses: data.contractAddresses,
      abi: data.abi ?? null,
      chainId: data.chainId ?? 42161,
    })
    .returning();
  return results[0];
}

export async function deleteDapp(db: Database, id: string) {
  return db.delete(dapps).where(eq(dapps.id, id));
}

export async function getDappByAddress(db: Database, address: string) {
  const allDapps = await db.select().from(dapps);
  return (
    allDapps.find((d) =>
      d.contractAddresses.some(
        (a: string) => a.toLowerCase() === address.toLowerCase(),
      ),
    ) ?? null
  );
}
