import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Check your .env file.");
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log("→ Connecting to database…");
  const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
  console.log(`✓ Connected. Server time: ${now.toISOString()}`);

  const counts = {
    users: await prisma.user.count(),
    items: await prisma.item.count(),
    itemTypes: await prisma.itemType.count(),
    collections: await prisma.collection.count(),
    tags: await prisma.tag.count(),
  };
  console.log("\nRow counts:");
  console.table(counts);

  const systemTypes = await prisma.itemType.findMany({
    where: { isSystem: true },
    select: { name: true, icon: true, color: true },
    orderBy: { name: "asc" },
  });
  console.log(`\nSystem item types (${systemTypes.length}):`);
  console.table(systemTypes);

  await prisma.$disconnect();
  console.log("\n✓ Done.");
}

main().catch(async (err) => {
  console.error("\n✗ Database test failed:");
  console.error(err);
  process.exit(1);
});
