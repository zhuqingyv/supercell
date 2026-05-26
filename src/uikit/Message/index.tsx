import { memo, useState, useCallback, useEffect, useRef } from "react";
import classNames from "classnames";

interface MessageProps {
  direction: "left" | "right";
  content: string;
  isLoading?: boolean;
  isStreaming?: boolean;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }, () => { /* clipboard permission denied — silently ignore */ });
  }, [code]);

  return (
    <div className="relative my-2 rounded-lg overflow-hidden" style={{ background: "var(--bg-base)", border: "1px solid var(--ai-bubble-border)" }}>
      <div className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--ai-bubble-border)", color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text-secondary)" }}>{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="hover-text-primary cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          aria-label="复制代码"
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-sm font-mono whitespace-pre" style={{ color: "var(--text-primary)" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Render inline markdown: **bold**, *italic*, `code`, ~~strike~~ */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|~~([^~\n]+)~~)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (full.startsWith("**")) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (full.startsWith("~~")) {
      parts.push(
        <del key={key++} className="opacity-60">
          {match[5]}
        </del>
      );
    } else if (full.startsWith("`")) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded text-sm font-mono" style={{ background: "var(--bg-elevated)", border: "1px solid var(--ai-bubble-border)" }}>
          {match[4]}
        </code>
      );
    } else if (full.startsWith("*")) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/** Render a block of text as markdown (headings, lists, blockquotes, paragraphs) */
function renderMarkdownBlock(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let orderedItems: React.ReactNode[] = [];
  let quoteLines: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    result.push(
      <ul key={key++} className="list-disc list-outside pl-5 my-1 space-y-0.5">
        {listItems}
      </ul>
    );
    listItems = [];
  };
  const flushOrdered = () => {
    if (!orderedItems.length) return;
    result.push(
      <ol key={key++} className="list-decimal list-outside pl-5 my-1 space-y-0.5">
        {orderedItems}
      </ol>
    );
    orderedItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    result.push(
      <blockquote
        key={key++}
        className="border-l-2 pl-3 my-1.5 opacity-80 italic"
        style={{ borderColor: "var(--accent-soft)" }}
      >
        {quoteLines.map((l, i) => (
          <span key={i}>
            {renderInline(l)}
            {i < quoteLines.length - 1 && <br />}
          </span>
        ))}
      </blockquote>
    );
    quoteLines = [];
  };

  for (const line of lines) {
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      flushList(); flushOrdered(); flushQuote();
      const level = hMatch[1].length;
      const sizeClass = (
        ["text-xl font-bold mt-3 mb-1", "text-lg font-semibold mt-2 mb-1", "text-base font-semibold mt-1.5 mb-0.5", "text-sm font-semibold mt-1"][level - 1]
      );
      result.push(<div key={key++} className={sizeClass}>{renderInline(hMatch[2])}</div>);
      continue;
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      flushOrdered(); flushQuote();
      listItems.push(<li key={key++}>{renderInline(ulMatch[1])}</li>);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      flushList(); flushQuote();
      orderedItems.push(<li key={key++}>{renderInline(olMatch[1])}</li>);
      continue;
    }

    const bqMatch = line.match(/^>\s?(.*)/);
    if (bqMatch) {
      flushList(); flushOrdered();
      quoteLines.push(bqMatch[1]);
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList(); flushOrdered(); flushQuote();
      result.push(<hr key={key++} className="my-2" style={{ borderColor: "var(--border-mid)" }} />);
      continue;
    }

    flushList(); flushOrdered(); flushQuote();
    if (line === "") {
      result.push(<div key={key++} className="h-2" />);
    } else {
      result.push(<div key={key++}>{renderInline(line)}</div>);
    }
  }

  flushList(); flushOrdered(); flushQuote();
  return <>{result}</>;
}

const renderMarkdownBlockCache = new Map<string, React.ReactNode>();

function renderMarkdownBlockCached(text: string): React.ReactNode {
  if (renderMarkdownBlockCache.has(text)) {
    return renderMarkdownBlockCache.get(text)!;
  }
  const result = renderMarkdownBlock(text);
  // Limit cache size to prevent memory leaks
  if (renderMarkdownBlockCache.size > 500) {
    const firstKey = renderMarkdownBlockCache.keys().next().value;
    if (firstKey) renderMarkdownBlockCache.delete(firstKey);
  }
  renderMarkdownBlockCache.set(text, result);
  return result;
}

function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (codeMatch) {
      return <CodeBlock key={i} lang={codeMatch[1]} code={codeMatch[2]} />;
    }
    return <div key={i}>{renderMarkdownBlockCached(part)}</div>;
  });
}

const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 1l1.2 4.4L14 8l-4.8 2.6L8 15l-1.2-4.4L2 8l4.8-2.6L8 1z" fill="white" fillOpacity="0.9"/>
  </svg>
);

export const Message = memo(function Message({ direction, content, isLoading, isStreaming }: MessageProps) {
  const flexDirection = direction === "left" ? "justify-start" : "justify-end";
  const isAssistant = direction === "left";
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleCopyMessage = useCallback(() => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }, () => { /* clipboard permission denied — silently ignore */ });
  }, [content]);

  const userBubbleStyle = {
    background: "linear-gradient(135deg, var(--user-bubble-from) 0%, var(--user-bubble-to) 100%)",
    boxShadow: "0 2px 8px rgba(84, 114, 240, 0.25)",
    borderRadius: "18px 18px 4px 18px",
  };

  const aiBubbleStyle = {
    background: "var(--ai-bubble)",
    border: "1px solid var(--ai-bubble-border)",
    borderRadius: "18px 18px 18px 4px",
  };

  return (
    <div className={classNames("flex flex-row mb-4 group", flexDirection)}>
      {isAssistant && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-2.5 mt-1 select-none"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--user-bubble-to))",
            boxShadow: "0 2px 8px var(--accent-glow)",
          }}
          aria-hidden
        >
          <SparkIcon />
        </div>
      )}
      <div
        className={classNames(
          "flex flex-col p-4 max-w-[85%] sm:max-w-[75%] break-words relative",
          "text-white"
        )}
        style={isAssistant ? aiBubbleStyle : userBubbleStyle}
      >
        {isLoading && !content ? (
          <span
            className="flex gap-1 items-center h-5"
            role="status"
            aria-label="AI 正在思考"
          >
            <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce motion-reduce:animate-none [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
          </span>
        ) : (
          <>
            {renderContent(content)}
            {isStreaming && (
              <span
                className="inline-block w-[2px] h-[1em] bg-white/80 animate-pulse motion-reduce:animate-none ml-0.5 align-text-bottom"
                aria-hidden
              />
            )}
            {isAssistant && content && !isStreaming && (
              <button
                type="button"
                onClick={handleCopyMessage}
                className="hover-text-primary absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs rounded px-1.5 py-0.5 cursor-pointer"
                style={{ color: "var(--text-muted)", background: "rgba(0,0,0,0.3)" }}
                aria-label="复制消息"
              >
                {copied ? "✓" : "复制"}
              </button>
            )}
          </>
        )}
      </div>
      {!isAssistant && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs ml-2.5 mt-1 select-none font-semibold"
          style={{
            background: "linear-gradient(135deg, #3d5bd9, #5472f0)",
          }}
          aria-hidden
        >
          我
        </div>
      )}
    </div>
  );
}, (prev, next) => prev.direction === next.direction && prev.content === next.content && prev.isLoading === next.isLoading && prev.isStreaming === next.isStreaming);
