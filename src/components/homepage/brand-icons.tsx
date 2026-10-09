/**
 * Brand marks for the homepage's "scattered knowledge" field. Inlined because
 * lucide-react no longer ships brand icons; simplified rather than pixel-exact.
 * GitHub's mark already lives at `@/components/auth/github-icon`.
 */

interface IconProps {
  className?: string;
}

export function NotionIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#fff" />
      <path
        d="M8 17V7.5L16 17V7"
        fill="none"
        stroke="#111"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SlackIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      strokeWidth="3.6"
      strokeLinecap="round"
    >
      <path d="M3.5 9.5H12M9.5 3.5v.1" stroke="#36C5F0" />
      <path d="M14.5 3.5V12M20.5 9.5h-.1" stroke="#2EB67D" />
      <path d="M20.5 14.5H12M14.5 20.5v-.1" stroke="#ECB22E" />
      <path d="M9.5 20.5V12M3.5 14.5h.1" stroke="#E01E5A" />
    </svg>
  );
}

export function VsCodeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#007ACC"
        d="M17.2 1.6 22.4 4v16l-5.2 2.4L7.6 13.6l-4 3.1-1.8-.9V8.2l1.8-.9 4 3.1 9.6-8.8Z"
      />
      <path fill="#1F9CF0" d="M17.2 7 11 12l6.2 5V7ZM3.7 9.5v5L6.3 12 3.7 9.5Z" />
    </svg>
  );
}
