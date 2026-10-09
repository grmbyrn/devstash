/**
 * The built-in item types, in canonical display order.
 *
 * This is the single source of truth for their names, Lucide icon names and
 * colors: `prisma/seed.ts` writes these rows, the sidebar sorts by this order,
 * and the public homepage renders them without a database round trip. It must
 * stay free of `@/` imports because the seed runs outside the Next.js build.
 */
export const SYSTEM_TYPES = [
  { name: "snippet", icon: "Code", color: "#3b82f6" },
  { name: "prompt", icon: "Sparkles", color: "#8b5cf6" },
  { name: "command", icon: "Terminal", color: "#f97316" },
  { name: "note", icon: "StickyNote", color: "#fde047" },
  { name: "link", icon: "Link", color: "#10b981" },
  { name: "file", icon: "File", color: "#6b7280" },
  { name: "image", icon: "Image", color: "#ec4899" },
] as const;

export type SystemType = (typeof SYSTEM_TYPES)[number];
export type SystemTypeName = SystemType["name"];

/** Look up a system type by name. Typed so an unknown name fails to compile. */
export function systemType(name: SystemTypeName): SystemType {
  return SYSTEM_TYPES.find((type) => type.name === name)!;
}
