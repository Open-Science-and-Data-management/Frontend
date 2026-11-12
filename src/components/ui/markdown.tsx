import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/utils/cn";

/**
 * Markdown from the AI, rendered as plain elements. Raw HTML in the text is
 * shown as text, never parsed, and images are dropped: a reply can't pull
 * anything into the page. Links open in a new tab.
 */
const COMPONENTS: Components = {
  p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>
  ),
  h1: ({ children }) => (
    <p className="mt-3 font-semibold first:mt-0">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mt-3 font-semibold first:mt-0">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mt-3 font-semibold first:mt-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded bg-background/60 p-2 first:mt-0 [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 pl-3 italic first:mt-0">
      {children}
    </blockquote>
  ),
};

export const Markdown: React.FC<{ children: string; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn("break-words", className)}>
    <ReactMarkdown components={COMPONENTS} disallowedElements={["img"]}>
      {children}
    </ReactMarkdown>
  </div>
);
