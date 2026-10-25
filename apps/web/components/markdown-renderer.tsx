"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { Check, Copy, ChevronDown, ChevronUp, Code } from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

function MermaidRenderer({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, chart.trim());
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Erreur de rendu Mermaid");
        }
      }
    };
    void renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="my-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-mono">
        <p className="font-bold">Erreur du diagramme Mermaid :</p>
        <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 text-gray-700">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 flex justify-center overflow-x-auto rounded-lg bg-[var(--surface-elevated)] p-4 shadow-xs border border-[var(--border)]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const lineCount = value.split("\n").length;
  // Automatically collapse long code blocks (> 12 lines) to avoid cluttering chat scroll
  const [collapsed, setCollapsed] = useState(lineCount > 12);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (language === "mermaid") {
    return <MermaidRenderer chart={value} />;
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xs text-[var(--foreground)]">
      {/* Code Block Header with Language & Collapse/Expand Button */}
      <div className="flex h-9 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3">
        <div className="flex items-center gap-2">
          <Code className="h-3.5 w-3.5 text-[var(--primary)]" />
          <span className="font-mono text-xs font-semibold text-[var(--foreground)] uppercase">
            {language || "code"}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)] font-mono">({lineCount} lignes)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            title="Copier le code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copié" : "Copier"}</span>
          </button>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            title={collapsed ? "Afficher le bloc de code" : "Réduire le bloc de code"}
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Afficher ({lineCount})</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Réduire</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      {!collapsed && (
        <div className="max-h-96 overflow-auto p-4 bg-[var(--editor-background)] text-[var(--editor-foreground)] font-mono text-xs leading-relaxed">
          <pre>
            <code>{value}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, className, children, ...props }: React.HTMLProps<HTMLElement> & { inline?: boolean }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const contentStr = String(children).replace(/\n$/, "");

          if (!inline && (language || contentStr.includes("\n"))) {
            return <CodeBlock language={language} value={contentStr} />;
          }

          return (
            <code className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 font-mono text-xs text-[var(--primary)] border border-[var(--border)]" {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
