export type ContentType = "TEXT" | "FILE";

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPro: boolean;
}

export interface ItemType {
  id: string;
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;
  urlPath: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  defaultTypeId: string | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  title: string;
  contentType: ContentType;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  url: string | null;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  language: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemTypeId: string;
  tagIds: string[];
  collectionIds: string[];
}

export const currentUser: User = {
  id: "user_1",
  name: "John Doe",
  email: "demo@devstash.io",
  image: null,
  isPro: true,
};

export const itemTypes: ItemType[] = [
  {
    id: "type_snippet",
    name: "snippet",
    icon: "Code",
    color: "#3b82f6",
    isSystem: true,
    urlPath: "/items/snippets",
  },
  {
    id: "type_prompt",
    name: "prompt",
    icon: "Sparkles",
    color: "#8b5cf6",
    isSystem: true,
    urlPath: "/items/prompts",
  },
  {
    id: "type_command",
    name: "command",
    icon: "Terminal",
    color: "#f97316",
    isSystem: true,
    urlPath: "/items/commands",
  },
  {
    id: "type_note",
    name: "note",
    icon: "StickyNote",
    color: "#fde047",
    isSystem: true,
    urlPath: "/items/notes",
  },
  {
    id: "type_link",
    name: "link",
    icon: "Link",
    color: "#10b981",
    isSystem: true,
    urlPath: "/items/links",
  },
  {
    id: "type_file",
    name: "file",
    icon: "File",
    color: "#6b7280",
    isSystem: true,
    urlPath: "/items/files",
  },
  {
    id: "type_image",
    name: "image",
    icon: "Image",
    color: "#ec4899",
    isSystem: true,
    urlPath: "/items/images",
  },
];

export const tags: Tag[] = [
  { id: "tag_react", name: "react" },
  { id: "tag_hooks", name: "hooks" },
  { id: "tag_typescript", name: "typescript" },
  { id: "tag_git", name: "git" },
  { id: "tag_safety", name: "safety" },
  { id: "tag_ai", name: "ai" },
  { id: "tag_review", name: "review" },
  { id: "tag_docker", name: "docker" },
  { id: "tag_devops", name: "devops" },
  { id: "tag_notes", name: "notes" },
  { id: "tag_template", name: "template" },
  { id: "tag_css", name: "css" },
  { id: "tag_tailwind", name: "tailwind" },
  { id: "tag_docs", name: "docs" },
  { id: "tag_storage", name: "storage" },
  { id: "tag_refactor", name: "refactor" },
  { id: "tag_design", name: "design" },
  { id: "tag_python", name: "python" },
];

export const collections: Collection[] = [
  {
    id: "col_react_patterns",
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    isFavorite: true,
    defaultTypeId: "type_snippet",
    itemIds: ["item_use_debounce", "item_use_local_storage"],
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-05-18T09:00:00.000Z",
  },
  {
    id: "col_ai_prompts",
    name: "AI Prompts",
    description: "Curated prompts for everyday workflows",
    isFavorite: false,
    defaultTypeId: "type_prompt",
    itemIds: ["item_code_review_prompt", "item_refactor_assistant_prompt"],
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-05-17T09:00:00.000Z",
  },
  {
    id: "col_devops_commands",
    name: "DevOps Commands",
    description: "Docker, k8s and CI shortcuts",
    isFavorite: false,
    defaultTypeId: "type_command",
    itemIds: ["item_git_force_push", "item_docker_cleanup"],
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-05-16T09:00:00.000Z",
  },
  {
    id: "col_interview_prep",
    name: "Interview Prep",
    description: "Notes and snippets for technical interviews",
    isFavorite: true,
    defaultTypeId: "type_note",
    itemIds: ["item_use_debounce", "item_use_local_storage"],
    createdAt: "2026-04-12T10:00:00.000Z",
    updatedAt: "2026-05-15T09:00:00.000Z",
  },
  {
    id: "col_design_resources",
    name: "Design Resources",
    description: "Links to design tools and inspiration",
    isFavorite: false,
    defaultTypeId: "type_link",
    itemIds: ["item_tailwind_docs"],
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-05-14T09:00:00.000Z",
  },
  {
    id: "col_python_snippets",
    name: "Python Snippets",
    description: "Useful Python snippets",
    isFavorite: false,
    defaultTypeId: "type_snippet",
    itemIds: [],
    createdAt: "2026-04-20T10:00:00.000Z",
    updatedAt: "2026-05-13T09:00:00.000Z",
  },
];

export const items: Item[] = [
  {
    id: "item_use_debounce",
    title: "useDebounce hook",
    contentType: "TEXT",
    content:
      "import { useEffect, useState } from 'react';\n\nexport function useDebounce<T>(value: T, delay = 300): T {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => {\n    const t = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(t);\n  }, [value, delay]);\n  return debounced;\n}",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Debounce a rapidly changing value for inputs and search.",
    isFavorite: true,
    isPinned: true,
    language: "typescript",
    lastUsedAt: "2026-05-18T08:30:00.000Z",
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-05-18T08:30:00.000Z",
    itemTypeId: "type_snippet",
    tagIds: ["tag_react", "tag_hooks", "tag_typescript"],
    collectionIds: ["col_react_patterns", "col_interview_prep"],
  },
  {
    id: "item_git_force_push",
    title: "Git force push safety",
    contentType: "TEXT",
    content: "git push --force-with-lease origin <branch>",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Force push without clobbering teammates' commits.",
    isFavorite: false,
    isPinned: false,
    language: "bash",
    lastUsedAt: "2026-05-17T14:20:00.000Z",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-05-17T14:20:00.000Z",
    itemTypeId: "type_command",
    tagIds: ["tag_git", "tag_safety"],
    collectionIds: ["col_devops_commands"],
  },
  {
    id: "item_code_review_prompt",
    title: "Code Review Prompt",
    contentType: "TEXT",
    content:
      "You are a senior engineer reviewing a pull request. Identify bugs, suggest improvements, and flag anything that would block a merge. Be concise.",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Reusable prompt for AI-assisted PR reviews.",
    isFavorite: true,
    isPinned: false,
    language: null,
    lastUsedAt: "2026-05-17T11:05:00.000Z",
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-05-17T11:05:00.000Z",
    itemTypeId: "type_prompt",
    tagIds: ["tag_ai", "tag_review"],
    collectionIds: ["col_ai_prompts"],
  },
  {
    id: "item_docker_cleanup",
    title: "Docker cleanup command",
    contentType: "TEXT",
    content: "docker system prune -af --volumes",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Free up disk space by clearing unused Docker resources.",
    isFavorite: false,
    isPinned: false,
    language: "bash",
    lastUsedAt: "2026-05-16T16:00:00.000Z",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-05-16T16:00:00.000Z",
    itemTypeId: "type_command",
    tagIds: ["tag_docker", "tag_devops"],
    collectionIds: ["col_devops_commands"],
  },
  {
    id: "item_meeting_notes_template",
    title: "Meeting notes template",
    contentType: "TEXT",
    content:
      "# Meeting — {{date}}\n\n## Attendees\n- \n\n## Agenda\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] ",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Markdown template for engineering meeting notes.",
    isFavorite: false,
    isPinned: false,
    language: "markdown",
    lastUsedAt: "2026-05-15T09:30:00.000Z",
    createdAt: "2026-04-12T10:00:00.000Z",
    updatedAt: "2026-05-15T09:30:00.000Z",
    itemTypeId: "type_note",
    tagIds: ["tag_notes", "tag_template"],
    collectionIds: [],
  },
  {
    id: "item_tailwind_docs",
    title: "Tailwind CSS Docs",
    contentType: "TEXT",
    content: null,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: "https://tailwindcss.com/docs",
    description: "Official Tailwind CSS documentation.",
    isFavorite: true,
    isPinned: false,
    language: null,
    lastUsedAt: "2026-05-14T10:00:00.000Z",
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-05-14T10:00:00.000Z",
    itemTypeId: "type_link",
    tagIds: ["tag_css", "tag_tailwind", "tag_docs"],
    collectionIds: ["col_design_resources"],
  },
  {
    id: "item_use_local_storage",
    title: "useLocalStorage hook",
    contentType: "TEXT",
    content:
      "import { useEffect, useState } from 'react';\n\nexport function useLocalStorage<T>(key: string, initial: T) {\n  const [value, setValue] = useState<T>(() => {\n    if (typeof window === 'undefined') return initial;\n    const raw = window.localStorage.getItem(key);\n    return raw ? (JSON.parse(raw) as T) : initial;\n  });\n  useEffect(() => {\n    window.localStorage.setItem(key, JSON.stringify(value));\n  }, [key, value]);\n  return [value, setValue] as const;\n}",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Sync state with localStorage.",
    isFavorite: false,
    isPinned: false,
    language: "typescript",
    lastUsedAt: "2026-05-13T15:45:00.000Z",
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-05-13T15:45:00.000Z",
    itemTypeId: "type_snippet",
    tagIds: ["tag_react", "tag_hooks", "tag_storage"],
    collectionIds: ["col_react_patterns", "col_interview_prep"],
  },
  {
    id: "item_refactor_assistant_prompt",
    title: "Refactor Assistant Prompt",
    contentType: "TEXT",
    content:
      "Refactor the following code for readability without changing behavior. Prefer small, well-named functions and remove dead code. Return only the updated code.",
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    description: "Prompt to drive an AI refactor pass.",
    isFavorite: false,
    isPinned: false,
    language: null,
    lastUsedAt: "2026-05-12T13:10:00.000Z",
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-05-12T13:10:00.000Z",
    itemTypeId: "type_prompt",
    tagIds: ["tag_ai", "tag_refactor"],
    collectionIds: ["col_ai_prompts"],
  },
];