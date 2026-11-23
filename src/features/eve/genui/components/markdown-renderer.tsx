"use client";

import { defineComponent } from "@openuidev/react-lang";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";
import { safeHref, safeImage } from "../safe";

/** Markdown without remote images or off-site links, for everything Eve writes. */
export function SafeMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ src, alt }) => {
          const safe = safeImage(src);
          return safe ? <img src={safe} alt={alt ?? ""} className="max-w-full rounded-lg" /> : <span>{alt}</span>;
        },
        a: ({ href, children }) => {
          const safe = safeHref(href);
          return safe ? <a href={safe} className="underline underline-offset-2">{children}</a> : <span>{children}</span>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

const MarkDownRendererSchema = z.object({
  text: z.string(),
});

export const MarkDownRenderer = defineComponent({
  name: "MarkDownRenderer",
  props: MarkDownRendererSchema,
  description: "Renders markdown text with GFM support.",
  component: ({ props }) => {
    const text = props.text == null ? "" : String(props.text);
    return (
      <div className="prose prose-neutral dark:prose-invert max-w-none text-sm">
        <SafeMarkdown text={text} />
      </div>
    );
  },
});
