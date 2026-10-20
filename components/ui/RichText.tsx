"use client";

import "katex/dist/katex.min.css";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { prepareMath } from "@/lib/math-text";

// remark-breaks keeps the line breaks people type or paste (e.g. a) b) c) on separate lines).
const REMARK = [remarkGfm, remarkMath, remarkBreaks];
const REHYPE: Parameters<typeof ReactMarkdown>[0]["rehypePlugins"] = [[rehypeKatex, { throwOnError: false, strict: false }]];

/**
 * Markdown + LaTeX maths ($…$, $$…$$, \(…\), \[…\]) for AI answers, quiz questions and explanations.
 * `inline` keeps the text inside one line-level element (for options, list previews and clamped rows).
 */
export default function RichText({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }) {
  const text = prepareMath(children);
  // A span wrapper when inline so it can sit inside <p>, <button> and <li>.
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={clsx("rich-text", inline && "rich-inline", className)}>
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={inline ? { p: ({ children }) => <span>{children}</span> } : undefined}
      >
        {text}
      </ReactMarkdown>
    </Wrapper>
  );
}
