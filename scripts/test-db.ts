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

  // ── Demo user ───────────────────────────────────────────────────────────
  const demo = await prisma.user.findUnique({
    where: { email: "demo@devstash.io" },
    select: { id: true, name: true, email: true, isPro: true, password: true },
  });

  if (!demo) {
    console.log("\n⚠ Demo user not found — run `npm run db:seed` first.");
    await prisma.$disconnect();
    return;
  }

  console.log("\nDemo user:");
  console.table({
    name: demo.name,
    email: demo.email,
    isPro: demo.isPro,
    passwordHashed: demo.password ? `yes (${demo.password.slice(0, 7)}…)` : "no",
  });

  // ── Collections with their items ──────────────────────────────────────
  const collections = await prisma.collection.findMany({
    where: { userId: demo.id },
    orderBy: { name: "asc" },
    include: {
      items: {
        include: { item: { include: { itemType: true } } },
      },
    },
  });

  console.log(`\nCollections (${collections.length}):`);
  console.table(
    collections.map((c) => ({
      name: c.name,
      description: c.description,
      items: c.items.length,
    })),
  );

  for (const collection of collections) {
    console.log(`\n▸ ${collection.name} — ${collection.items.length} item(s)`);
    console.table(
      collection.items.map(({ item }) => ({
        type: item.itemType.name,
        title: item.title,
        contentType: item.contentType,
        detail: item.url ?? item.content?.split("\n")[0]?.slice(0, 50) ?? "",
      })),
    );
  }

  const totalItems = collections.reduce((sum, c) => sum + c.items.length, 0);
  console.log(
    `\nSummary: ${collections.length} collections, ${totalItems} items for ${demo.email}.`,
  );

  await prisma.$disconnect();
  console.log("\n✓ Done.");
}

main().catch(async (err) => {
  console.error("\n✗ Database test failed:");
  console.error(err);
  process.exit(1);
});
