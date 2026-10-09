export interface NavLink {
  href: string;
  label: string;
}

/**
 * Homepage sections, addressed from the root so they work from any page —
 * on `/` itself the browser just scrolls.
 */
export const SECTION_LINKS: NavLink[] = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
];
