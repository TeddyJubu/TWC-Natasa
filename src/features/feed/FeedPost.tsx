// One post on the feed (DESIGN.md "Newsfeed"): the canvas's .post under a hairline ink rule — the author's round avatar,
// the kind as a badge, her words and photos, who loved it, and the replies. Everything shown is something a member wrote.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { askConfirm } from "@/app/layout/confirm";
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

/** A member's round avatar (the canvas's .av): her portrait, or initials on lime, never a stand-in photo. Decorative: her name is beside it. */
export function MiniStamp({ name, image, size }: { name: string; image?: string; size?: "s" | "l" | "xl" }) {
  return (
    <span aria-hidden className={cn("air-ms", size && `air-ms--${size}`)}>
      {image ? <img src={image} alt="" loading="lazy" /> : <i>{initials(name)}</i>}
    </span>
  );
}

/** Her name, linked to her member page when she has one. */
function Name({ author }: { author: FeedAuthor }) {
  return author.slug
    ? <Link to="/members/$slug" params={{ slug: author.slug }} className={cn("air-entry-name", ring)}>{author.name}</Link>
    : <span className="air-entry-name">{author.name}</span>;
}

const When = ({ iso }: { iso: string }) => <time dateTime={iso} title={postedAt(iso)}>{postedAgo(iso)}</time>;

export function FeedPost({ post }: { post: Post }) {
  const kind = KINDS[post.kind];
  const love = useLove(post.id);
  const remove = useDeletePost(post.id);
  const [replying, setReplying] = React.useState(false);
  const replyField = React.useRef<HTMLInputElement>(null);
  const self = React.useRef<HTMLElement>(null);
  // While a love is on its way, show it as sent; the server's answer replaces it.
  const loved = love.isPending ? love.variables ?? post.loved : post.loved;
  const loves = post.loves + (loved === post.loved ? 0 : loved ? 1 : -1);
  // A love pops the heart and throws a few dots for a moment (CSS; none under reduced motion).
  const [pop, setPop] = React.useState(0);
  React.useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(0), 600);
    return () => clearTimeout(t);
  }, [pop]);

  function startReply() {
    setReplying(true);
    requestAnimationFrame(() => replyField.current?.focus());
  }
  async function deletePost() {
    if (!(await askConfirm("Delete this post? Its loves and replies go with it.", "Delete post", true))) return;
    // The post and its focused button go away: hand focus to the next post (else the one before, else the page), not <body>.
    const posts = [...document.querySelectorAll<HTMLElement>("article.air-entry")];
    const i = posts.indexOf(self.current!);
    const next = posts[i + 1] ?? posts[i - 1] ?? document.getElementById("main");
    // mutateAsync: a per-call onSuccess never runs once this post unmounts. A failure shows on the post (remove.isError).
    remove.mutateAsync().then(() => next?.focus(), () => {});
  }

  return (
    <article ref={self} tabIndex={-1} className={cn("air-entry", ring)} aria-label={`${kind.label} from ${post.author.name}`}>
      <header className="air-entry-h">
        <MiniStamp name={post.author.name} image={post.author.image} />
        <div className="min-w-0 flex-1">
          <Name author={post.author} />
          <p className="air-entry-meta">
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
      {remove.isError && <p role="alert" className="air-entry-err">{errorMessage(remove.error)}</p>}
      {post.body && <p className="air-entry-b">{post.body}</p>}
      {post.photos.length > 0 && <Photos post={post} />}
      {loves > 0 && <p className="air-entry-loved">{lovedLine(loves, loved, post.lovedBy)}</p>}
      <footer className="air-entry-act">
        <button type="button" aria-pressed={loved} onClick={() => { if (!loved) setPop(Date.now()); love.mutate(!loved); }} disabled={love.isPending}
          aria-label={`Love (${loves})`} className={cn("air-act", pop > 0 && "is-popping", ring)}>
          <Icon name="heart" />{loves}
          {pop > 0 && <span aria-hidden key={pop} className="air-like-dots">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}</span>}
        </button>
        <button type="button" onClick={startReply} aria-label={`Reply (${post.replies.length})`} className={cn("air-act", ring)}>
          <Icon name="message-circle" />{post.replies.length}
        </button>
        {love.isError && <p role="alert" className="air-entry-err ml-auto">{errorMessage(love.error)}</p>}
      </footer>
      {(post.replies.length > 0 || replying) && <Thread post={post} replying={replying} field={replyField} />}
    </article>
  );
}

/** One photo full width, two side by side, three or four in a grid. Each opens full size. */
function Photos({ post }: { post: Post }) {
  const n = post.photos.length;
  return (
    <div className={cn("air-entry-media", `is-${n}`)}>
      {post.photos.map((p, i) => (
        <a key={p.url} href={p.url} target="_blank" rel="noopener" className={ring}>
          <img src={p.url} alt={p.alt || `Photo ${i + 1} of ${n} from ${post.author.name}`} loading="lazy" />
          <span className="sr-only"> (opens full size in a new tab)</span>
        </a>
      ))}
    </div>
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
  async function deleteReply(r: FeedReply, button: HTMLElement) {
    if (!(await askConfirm("Delete this reply?", "Delete reply", true))) return;
    const post = button.closest("article"); // its button goes with it, so focus returns to the post
    remove.mutateAsync(r.id).then(() => post?.focus(), () => {});
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
                <p className="text-[13px]"><Name author={r.author} /><span className="air-entry-meta ml-1.5 inline">{r.author.neighborhood && `${r.author.neighborhood} · `}<When iso={r.createdAt} /></span></p>
                <p className="air-reply-b">{r.body}</p>
              </div>
              {r.canDelete && (
                <button type="button" onClick={(e) => deleteReply(r, e.currentTarget)} aria-label={`Delete reply from ${r.author.name}`} className={cn("air-icon-btn air-icon-btn--sm", ring)}>
                  <Icon name="trash" className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(send.isError || remove.isError) && <p role="alert" className="air-entry-err">{errorMessage(send.error ?? remove.error)}</p>}
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
