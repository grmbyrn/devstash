import "dotenv/config";

import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const SYSTEM_TYPES = [
  { name: "snippet", icon: "Code", color: "#3b82f6" },
  { name: "prompt", icon: "Sparkles", color: "#8b5cf6" },
  { name: "command", icon: "Terminal", color: "#f97316" },
  { name: "note", icon: "StickyNote", color: "#fde047" },
  { name: "file", icon: "File", color: "#6b7280" },
  { name: "image", icon: "Image", color: "#ec4899" },
  { name: "link", icon: "Link", color: "#10b981" },
] as const;

type SeedItem = {
  title: string;
  type: (typeof SYSTEM_TYPES)[number]["name"];
  description?: string;
  content?: string;
  url?: string;
  language?: string;
};

type SeedCollection = {
  name: string;
  description: string;
  isFavorite?: boolean;
  items: SeedItem[];
};

const COLLECTIONS: SeedCollection[] = [
  {
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    isFavorite: true,
    items: [
      {
        title: "useDebounce",
        type: "snippet",
        language: "typescript",
        description: "Debounce a rapidly-changing value (e.g. a search input).",
        content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}`,
      },
      {
        title: "Theme context provider",
        type: "snippet",
        language: "typescript",
        description:
          "Typed React context with a colocated hook that guards against a missing provider.",
        content: `import { createContext, useContext, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}`,
      },
      {
        title: "cn class merge helper",
        type: "snippet",
        language: "typescript",
        description: "Merge conditional class names and dedupe Tailwind utilities.",
        content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
      },
    ],
  },
  {
    name: "AI Workflows",
    isFavorite: true,
    description: "AI prompts and workflow automations",
    items: [
      {
        title: "Code review prompt",
        type: "prompt",
        description: "Ask an LLM for a focused, actionable code review.",
        content: `You are a senior engineer doing a code review. Review the diff below.

Focus, in priority order, on:
1. Correctness bugs and edge cases
2. Security issues
3. Readability and naming
4. Opportunities to simplify or reuse existing code

For each finding give the file/line, a one-line explanation, and a concrete fix. Skip nitpicks unless asked. End with a verdict: approve, approve with comments, or request changes.

\`\`\`diff
{{DIFF}}
\`\`\``,
      },
      {
        title: "Documentation generation prompt",
        type: "prompt",
        description: "Generate reference docs for a module from its source.",
        content: `Generate developer documentation for the code below.

Output Markdown with:
- A one-paragraph overview of what the module does
- An API table: each export with its signature and a one-line description
- A minimal runnable usage example
- Any gotchas or important constraints

Match the tone of concise open-source READMEs. Do not invent behavior that isn't in the code.

\`\`\`
{{CODE}}
\`\`\``,
      },
      {
        title: "Refactoring assistance prompt",
        type: "prompt",
        description: "Propose a safe, incremental refactor without changing behavior.",
        content: `Refactor the code below to improve clarity and maintainability while preserving behavior exactly.

Constraints:
- Do not change the public API or observable behavior
- Prefer small, reviewable steps over one large rewrite
- Explain the reasoning behind each change in one line

Return: (1) the refactored code, (2) a bullet list of what changed and why, (3) any tests worth adding to lock in behavior.

\`\`\`
{{CODE}}
\`\`\``,
      },
    ],
  },
  {
    name: "DevOps",
    description: "Infrastructure and deployment resources",
    items: [
      {
        title: "Multi-stage Node Dockerfile",
        type: "snippet",
        language: "dockerfile",
        description: "Slim production image for a Node app using a multi-stage build.",
        content: `# syntax=docker/dockerfile:1
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]`,
      },
      {
        title: "Deploy migrations and release",
        type: "command",
        description: "Run pending Prisma migrations, then build and start production.",
        content: `npx prisma migrate deploy && npm run build && npm start`,
      },
      {
        title: "Docker — build and package images (docs)",
        type: "link",
        description: "Official Docker guide for building and tagging images.",
        url: "https://docs.docker.com/build/building/packaging/",
      },
      {
        title: "GitHub Actions — workflow syntax",
        type: "link",
        description: "Reference for GitHub Actions workflow and CI/CD configuration.",
        url: "https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions",
      },
    ],
  },
  {
    name: "Terminal Commands",
    description: "Useful shell commands for everyday development",
    items: [
      {
        title: "Undo last commit, keep changes",
        type: "command",
        description: "Reset the last commit but leave the working tree untouched.",
        content: `git reset --soft HEAD~1`,
      },
      {
        title: "Prune stopped containers and dangling images",
        type: "command",
        description: "Reclaim disk space from unused Docker resources.",
        content: `docker system prune -f`,
      },
      {
        title: "Find and kill the process on a port",
        type: "command",
        description: "When a dev server didn't shut down cleanly (port 3000 here).",
        content: `lsof -ti tcp:3000 | xargs kill -9`,
      },
      {
        title: "Trace why a package is installed",
        type: "command",
        description: "Show the dependency chain that pulled a package in.",
        content: `npm ls <package-name>`,
      },
    ],
  },
  {
    name: "Design Resources",
    description: "UI/UX resources and references",
    items: [
      {
        title: "Tailwind CSS docs",
        type: "link",
        description: "Utility-first CSS framework — full reference.",
        url: "https://tailwindcss.com/docs",
      },
      {
        title: "shadcn/ui",
        type: "link",
        description: "Copy-paste accessible React components built on Radix + Tailwind.",
        url: "https://ui.shadcn.com",
      },
      {
        title: "Radix UI Primitives",
        type: "link",
        description: "Unstyled, accessible component primitives for design systems.",
        url: "https://www.radix-ui.com/primitives",
      },
      {
        title: "Lucide icons",
        type: "link",
        description: "Open-source icon library (the set DevStash item types use).",
        url: "https://lucide.dev/icons",
      },
    ],
  },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // ── System item types ────────────────────────────────────────────────
  for (const type of SYSTEM_TYPES) {
    const existing = await prisma.itemType.findFirst({
      where: { name: type.name, isSystem: true, userId: null },
    });
    if (existing) {
      await prisma.itemType.update({
        where: { id: existing.id },
        data: { icon: type.icon, color: type.color },
      });
    } else {
      await prisma.itemType.create({
        data: { ...type, isSystem: true, userId: null },
      });
    }
  }
  console.log(`Seeded ${SYSTEM_TYPES.length} system item types.`);

  const typeIdByName = new Map<string, string>();
  for (const t of await prisma.itemType.findMany({
    where: { isSystem: true, userId: null },
  })) {
    typeIdByName.set(t.name, t.id);
  }

  // ── Demo user ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("12345678", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@devstash.io" },
    update: {
      name: "Demo User",
      isPro: false,
      emailVerified: new Date(),
      password: passwordHash,
    },
    create: {
      email: "demo@devstash.io",
      name: "Demo User",
      isPro: false,
      emailVerified: new Date(),
      password: passwordHash,
    },
  });
  console.log(`Seeded demo user ${user.email}.`);

  // ── Reset the demo user's collections & items so the seed is idempotent ─
  await prisma.item.deleteMany({ where: { userId: user.id } });
  await prisma.collection.deleteMany({ where: { userId: user.id } });

  // ── Collections & items ───────────────────────────────────────────────
  let itemCount = 0;
  for (const col of COLLECTIONS) {
    const collection = await prisma.collection.create({
      data: {
        name: col.name,
        description: col.description,
        isFavorite: col.isFavorite ?? false,
        userId: user.id,
      },
    });

    for (const item of col.items) {
      const itemTypeId = typeIdByName.get(item.type);
      if (!itemTypeId) throw new Error(`Missing system type: ${item.type}`);

      await prisma.item.create({
        data: {
          title: item.title,
          description: item.description ?? null,
          contentType: "TEXT",
          content: item.content ?? null,
          url: item.url ?? null,
          language: item.language ?? null,
          userId: user.id,
          itemTypeId,
          collections: { create: { collectionId: collection.id } },
        },
      });
      itemCount++;
    }
  }
  console.log(
    `Seeded ${COLLECTIONS.length} collections with ${itemCount} items.`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
