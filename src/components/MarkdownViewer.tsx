import React from "react";

type MarkdownViewerProps = {
  content: string;
};

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-900">{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={idx} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  const lines = content.split("\n");

  return (
    <article className="prose prose-neutral max-w-none">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed === "---") return <hr key={idx} className="my-4 border-neutral-200" />;

        if (trimmed.startsWith("### ")) {
          return <h3 key={idx} className="text-lg font-semibold text-neutral-900 mt-6">{parseInline(trimmed.slice(4))}</h3>;
        }
        if (trimmed.startsWith("## ")) {
          return <h2 key={idx} className="text-xl font-semibold text-neutral-900 mt-8">{parseInline(trimmed.slice(3))}</h2>;
        }
        if (trimmed.startsWith("# ")) {
          return <h1 key={idx} className="text-2xl font-semibold text-neutral-900 mt-8">{parseInline(trimmed.slice(2))}</h1>;
        }

        if (trimmed.startsWith("- ")) {
          return (
            <ul key={idx} className="list-disc pl-6 text-sm text-neutral-700">
              <li>{parseInline(trimmed.slice(2))}</li>
            </ul>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <ol key={idx} className="list-decimal pl-6 text-sm text-neutral-700">
              <li>{parseInline(trimmed.replace(/^\d+\.\s/, ""))}</li>
            </ol>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={idx} className="border-l-4 border-indigo-200 pl-3 italic text-neutral-700">
              {parseInline(trimmed.slice(2))}
            </blockquote>
          );
        }

        return <p key={idx} className="text-sm text-neutral-700 leading-6">{parseInline(trimmed)}</p>;
      })}
    </article>
  );
}
