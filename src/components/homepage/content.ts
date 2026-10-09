import type { ComponentType } from "react";
import {
  AppWindow,
  Bookmark,
  FileText,
  FolderOpen,
  Search,
  SquareTerminal,
} from "lucide-react";

import { GithubIcon } from "@/components/auth/github-icon";
import type { SystemTypeName } from "@/lib/system-types";

import { NotionIcon, SlackIcon, VsCodeIcon } from "./brand-icons";

/**
 * Static homepage content. Anything that repeats on the page lives here as a
 * typed array, so the section components only lay it out.
 */

type IconComponent = ComponentType<{ className?: string }>;

// ─── Calls to action ─────────────────────────────────────────────────────

export interface CallToAction {
  href: string;
  label: string;
}

/** Where the main "get started" buttons go — signed-in users skip sign-up. */
export function primaryCta(signedIn: boolean): CallToAction {
  return signedIn
    ? { href: "/dashboard", label: "Go to Dashboard" }
    : { href: "/register", label: "Get Started Free" };
}

export const SECTION_LINKS: CallToAction[] = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

// ─── Hero ────────────────────────────────────────────────────────────────

export interface ChaosIcon {
  label: string;
  Icon: IconComponent;
  /** Tint for monochrome icons; brand marks carry their own colors. */
  className?: string;
  /** Starting position as a percentage of the field, before animation. */
  x: number;
  y: number;
}

export const CHAOS_ICONS: ChaosIcon[] = [
  { label: "Notion", Icon: NotionIcon, x: 5, y: 6 },
  { label: "GitHub", Icon: GithubIcon, className: "text-white", x: 32, y: 22 },
  { label: "Slack", Icon: SlackIcon, x: 56, y: 4 },
  { label: "VS Code", Icon: VsCodeIcon, x: 76, y: 28 },
  { label: "Browser tabs", Icon: AppWindow, className: "text-indigo-300", x: 12, y: 48 },
  { label: "Terminal", Icon: SquareTerminal, className: "text-cyan-300", x: 46, y: 52 },
  { label: "Text file", Icon: FileText, className: "text-slate-300", x: 20, y: 76 },
  { label: "Bookmark", Icon: Bookmark, className: "text-pink-300", x: 70, y: 74 },
];

export interface PreviewItem {
  title: string;
  type: SystemTypeName;
}

export const PREVIEW_ITEMS: PreviewItem[] = [
  { title: "useDebounce", type: "snippet" },
  { title: "Code reviewer", type: "prompt" },
  { title: "git rebase -i", type: "command" },
  { title: "Auth notes", type: "note" },
  { title: "Tailwind docs", type: "link" },
  { title: "Wireframe.png", type: "image" },
];

// ─── Features ────────────────────────────────────────────────────────────

export interface Feature {
  title: string;
  description: string;
  /** Supplies the accent color, and the icon unless `Icon` overrides it. */
  type: SystemTypeName;
  Icon?: IconComponent;
}

export const FEATURES: Feature[] = [
  {
    title: "Code Snippets",
    description:
      "Save reusable code with syntax highlighting for every major language. Copy in one click.",
    type: "snippet",
  },
  {
    title: "AI Prompts",
    description:
      "Keep your best prompts, system messages and context files out of lost chat history.",
    type: "prompt",
  },
  {
    title: "Instant Search",
    description:
      "Full-text search across titles, content, tags and types. Find anything in milliseconds.",
    type: "link",
    Icon: Search,
  },
  {
    title: "Commands",
    description:
      "Stop digging through bash history. Store the commands you always forget, ready to paste.",
    type: "command",
  },
  {
    title: "Files & Docs",
    description:
      "Upload config files, docs and images alongside your notes, with previews and one-click download.",
    type: "file",
  },
  {
    title: "Collections",
    description:
      'Group items into collections. One snippet can live in "React Patterns" and "Interview Prep" at once.',
    type: "image",
    Icon: FolderOpen,
  },
];

// ─── AI ──────────────────────────────────────────────────────────────────

export const AI_CAPABILITIES = [
  { title: "Auto-tagging", description: "relevant tags suggested the moment you save" },
  { title: "Summaries", description: "a one-line summary for any snippet or note" },
  { title: "Explain code", description: "plain-English explanations of unfamiliar code" },
  { title: "Prompt optimizer", description: "rewrite prompts for clarity and better results" },
];

export const AI_TAGS = ["react", "hooks", "typescript", "debounce", "performance"];

// ─── Pricing ─────────────────────────────────────────────────────────────

export type Billing = "monthly" | "yearly";

export interface PlanPrice {
  amount: string;
  period: string;
  note?: string;
}

export interface Plan {
  name: string;
  description: string;
  /** One price for every billing cycle, or one per cycle. */
  price: PlanPrice | Record<Billing, PlanPrice>;
  cta: CallToAction;
  features: { label: string; included: boolean }[];
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    name: "Free",
    description: "For getting your essentials in one place.",
    price: { amount: "$0", period: "/forever" },
    cta: { href: "/register", label: "Get Started" },
    features: [
      { label: "50 items", included: true },
      { label: "3 collections", included: true },
      { label: "Snippets, prompts, commands, notes & links", included: true },
      { label: "Basic search", included: true },
      { label: "File & image uploads", included: false },
      { label: "AI features", included: false },
    ],
  },
  {
    name: "Pro",
    description: "For developers who live in their knowledge base.",
    price: {
      monthly: { amount: "$8", period: "/month", note: "Billed monthly" },
      yearly: { amount: "$72", period: "/year", note: "That's $6/month, billed yearly" },
    },
    cta: { href: "/register", label: "Upgrade to Pro" },
    features: [
      { label: "Unlimited items & collections", included: true },
      { label: "File & image uploads", included: true },
      { label: "All AI features", included: true },
      { label: "Export as JSON or ZIP", included: true },
      { label: "Priority support", included: true },
    ],
    highlighted: true,
  },
];

// ─── Footer ──────────────────────────────────────────────────────────────

export interface FooterColumn {
  title: string;
  links: CallToAction[];
}

/** Only links with a real destination; account links follow the session. */
export function footerColumns(signedIn: boolean): FooterColumn[] {
  return [
    { title: "Product", links: SECTION_LINKS },
    {
      title: "Account",
      links: signedIn
        ? [
            { href: "/dashboard", label: "Dashboard" },
            { href: "/profile", label: "Profile" },
          ]
        : [
            { href: "/sign-in", label: "Sign In" },
            { href: "/register", label: "Create Account" },
          ],
    },
  ];
}
