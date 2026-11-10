// One post on the feed (DESIGN.md "Newsfeed"): a paper letter with the author's mini stamp, the kind as a chip, her words
// and photos (the first postmarked), who loved it, and the replies. Everything shown is something a member wrote.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn, initials } from "@/index";
import { Chip } from "@/app/layout/app-ui";
import { fieldClass, ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { errorMessage } from "@/features/account/helpers";
import { KINDS, MAX_REPLY } from "./kinds";
import { lovedLine, postedAgo, postedAt } from "./format";
import { useDeletePost, useDeleteReply, useLove, useReply } from "./mutations";
import type { FeedAuthor, FeedPost as Post, FeedReply } from "./queries";

/** Replies shown before "Show all". */
const FOLDED = 2;

/** A member's portrait (or initials on navy, never a stand-in photo) as a tiny perforated stamp. Decorative: her name is beside it. */
export function MiniStamp({ name, image, size }: { name: string; image?: string; size?: "s" | "l" | "xl" }) {
  return (
    <span aria-hidden className={cn("air-ms", size && `air-ms--${size}`)}>
      <span><i>{image ? <img src={image} alt="" loading="lazy" /> : initials(name)}</i></span>
    </span>
  );
}

/** Her name, linked to her member page when she has one. */
function Name({ author }: { author: FeedAuthor }) {
  return author.slug
    ? <Link to="/members/$slug" params={{ slug: author.slug }} className={cn("air-post-name", ring)}>{author.name}</Link>
    : <span className="air-post-name">{author.name}</span>;
}

const When = ({ iso }: { iso: string }) => <time dateTime={iso} title={postedAt(iso)}>{postedAgo(iso)}</time>;

export function FeedPost({ post }: { post: Post }) {
  const kind = KINDS[post.kind];
  const love = useLove(post.id);
  const remove = useDeletePost(post.id);
  const [replying, setReplying] = React.useState(false);
  const replyField = React.useRef<HTMLInputElement>(null);
  // While a love is on its way, show it as sent; the server's answer replaces it.
  const loved = love.isPending ? love.variables ?? post.loved : post.loved;
  const loves = post.loves + (loved === post.loved ? 0 : loved ? 1 : -1);

  function startReply() {
    setReplying(true);
    requestAnimationFrame(() => replyField.current?.focus());
  }
  function deletePost() {
    if (window.confirm("Delete this post? Its loves and replies go with it.")) remove.mutate();
  }

  return (
    <article className="air-post" aria-label={`${kind.label} from ${post.author.name}`}>
      <header className="air-post-h">
        <MiniStamp name={post.author.name} image={post.author.image} />
        <div className="min-w-0 flex-1">
          <Name author={post.author} />
          <p className="air-post-meta">
            {[post.author.line, post.author.neighborhood].filter(Boolean).map((s) => `${s} · `).join("")}<When iso={post.createdAt} />
          </p>
        </div>
        <Chip><Icon name={kind.icon} className="size-3" />{kind.label}</Chip>
        {post.canDelete && (
          <button type="button" onClick={deletePost} disabled={remove.isPending} aria-label="Delete this post" className={cn("air-icon-btn air-icon-btn--sm", ring)}>
            <Icon name="trash" className="size-4" />
          </button>
        )}
      </header>
      {remove.isError && <p role="alert" className="air-post-err">{errorMessage(remove.error)}</p>}
      {post.body && <p className="air-post-b">{post.body}</p>}
      {post.photos.length > 0 && <Photos post={post} />}
      {loves > 0 && <p className="air-post-loved">{lovedLine(loves, loved, post.lovedBy)}</p>}
      <footer className="air-post-act">
        <button type="button" aria-pressed={loved} onClick={() => love.mutate(!loved)} disabled={love.isPending}
          aria-label={`Love (${loves})`} className={cn("air-act", ring)}>
          <Icon name="heart" />{loves}
        </button>
        <button type="button" onClick={startReply} aria-label={`Reply (${post.replies.length})`} className={cn("air-act", ring)}>
          <Icon name="message-circle" />{post.replies.length}
        </button>
        {love.isError && <p role="alert" className="air-post-err ml-auto">{errorMessage(love.error)}</p>}
      </footer>
      {(post.replies.length > 0 || replying) && <Thread post={post} replying={replying} field={replyField} />}
    </article>
  );
}

/** One photo full width, two side by side, three or four in a grid. Each opens full size; the first carries a postmark. */
function Photos({ post }: { post: Post }) {
  const n = post.photos.length;
  return (
    <div className={cn("air-post-media", `is-${n}`)}>
      {post.photos.map((p, i) => (
        <a key={p.url} href={p.url} target="_blank" rel="noopener" className={ring}>
          <img src={p.url} alt={p.alt || `Photo ${i + 1} of ${n} from ${post.author.name}`} loading="lazy" />
          <span className="sr-only"> (opens full size in a new tab)</span>
        </a>
      ))}
      <Postmark where={post.author.neighborhood} iso={post.createdAt} />
    </div>
  );
}

/** A cancellation on the first photo: where she posts from and the day (decorative; both are in the header). */
function Postmark({ where, iso }: { where: string; iso: string }) {
  const id = React.useId();
  const d = new Date(iso);
  const opts = { timeZone: "America/New_York" } as const;
  const date = `${d.toLocaleDateString("en-US", { day: "numeric", ...opts })} ${d.toLocaleDateString("en-US", { month: "short", ...opts }).toUpperCase()}`;
  return (
    <svg aria-hidden viewBox="0 0 220 112" fill="none" stroke="currentColor" className="air-post-pm">
      <defs><path id={id} d="M16 56a40 40 0 1 1 80 0a40 40 0 1 1-80 0" /></defs>
      <circle cx="56" cy="56" r="52" strokeWidth="2" /><circle cx="56" cy="56" r="30" strokeWidth="1.5" />
      <text fontSize="10" fontWeight="600" letterSpacing="2.2" fill="currentColor" stroke="none">
        <textPath href={`#${id}`}>{`${(where || "Queens").toUpperCase()} · QUEENS · TWC ·`}</textPath>
      </text>
      <text x="56" y="57" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" stroke="none">{date}</text>
      <text x="56" y="70" textAnchor="middle" fontSize="9.5" fontWeight="600" letterSpacing="1.5" fill="currentColor" stroke="none">
        {d.toLocaleDateString("en-US", { year: "numeric", ...opts })}
      </text>
      <path d="M112 34q10-8 20 0t20 0t20 0t20 0M112 50q10-8 20 0t20 0t20 0t20 0M112 66q10-8 20 0t20 0t20 0t20 0M112 82q10-8 20 0t20 0t20 0t20 0" strokeWidth="2.4" />
    </svg>
  );
}

/** The replies (the latest two until she asks for all) and, once she presses Reply, a box to write one. */
function Thread({ post, replying, field }: { post: Post; replying: boolean; field: React.RefObject<HTMLInputElement | null> }) {
  const [all, setAll] = React.useState(false);
  const [body, setBody] = React.useState("");
  const send = useReply(post.id);
  const remove = useDeleteReply(post.id);
  const shown = all ? post.replies : post.replies.slice(-FOLDED);
  const hidden = post.replies.length - shown.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim()) send.mutate(body, { onSuccess: () => setBody("") });
  }
  function deleteReply(r: FeedReply) {
    if (window.confirm("Delete this reply?")) remove.mutate(r.id);
  }

  return (
    <div className="air-thread">
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className={cn("air-link", ring)}>
          Show {hidden === 1 ? "1 earlier reply" : `${hidden} earlier replies`}
        </button>
      )}
      {shown.length > 0 && (
        <ul aria-label={`Replies to ${post.author.name}`} className="grid gap-2">
          {shown.map((r) => (
            <li key={r.id} className="air-reply">
              <MiniStamp name={r.author.name} image={r.author.image} size="s" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px]"><Name author={r.author} /><span className="air-post-meta ml-1.5 inline">{r.author.neighborhood && `${r.author.neighborhood} · `}<When iso={r.createdAt} /></span></p>
                <p className="air-reply-b">{r.body}</p>
              </div>
              {r.canDelete && (
                <button type="button" onClick={() => deleteReply(r)} aria-label={`Delete reply from ${r.author.name}`} className={cn("air-icon-btn air-icon-btn--sm", ring)}>
                  <Icon name="trash" className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(send.isError || remove.isError) && <p role="alert" className="air-post-err">{errorMessage(send.error ?? remove.error)}</p>}
      {replying && (
        <form onSubmit={submit} className="air-reply-in">
          <label className="sr-only" htmlFor={`reply-${post.id}`}>Reply to {post.author.name}</label>
          <input ref={field} id={`reply-${post.id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_REPLY}
            placeholder="Write a reply…" autoComplete="off" className={fieldClass} />
          <button type="submit" disabled={send.isPending || !body.trim()} aria-label="Send reply" className={cn("air-send", ring)}>
            <Icon name="send" className="size-4" />
          </button>
        </form>
      )}
    </div>
  );
}
