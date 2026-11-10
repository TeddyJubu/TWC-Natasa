// The feed's composer (DESIGN.md "Newsfeed"): her mini stamp, the words, what kind of post it is, up to four photos
// each with an optional description, and Post (the page's one red button).
import * as React from "react";
import { cn } from "@/index";
import { fieldClass, redButton, ring } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { errorMessage } from "@/features/account/helpers";
import { AVATAR_TYPES } from "@/features/members/mutations";
import { FEED_KINDS, KINDS, MAX_ALT, MAX_PHOTOS, MAX_POST, type FeedKind } from "./kinds";
import { MiniStamp } from "./FeedPost";
import { photoProblem, useCreatePost, type DraftPhoto } from "./mutations";

type Picked = DraftPhoto & { url: string };

export function Composer({ name, image }: { name: string; image?: string }) {
  const create = useCreatePost();
  const [kind, setKind] = React.useState<FeedKind>("update");
  const [body, setBody] = React.useState("");
  const [photos, setPhotos] = React.useState<Picked[]>([]);
  const [problem, setProblem] = React.useState<string | null>(null);
  const field = React.useRef<HTMLTextAreaElement>(null);
  const first = name.split(/\s+/)[0];

  // Previews are object URLs: let each go when its photo leaves the draft, and all of them on the way out.
  const urls = React.useRef<string[]>([]);
  urls.current = photos.map((p) => p.url);
  React.useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    const bad = files.map(photoProblem).find(Boolean);
    const room = MAX_PHOTOS - photos.length;
    setProblem(bad ?? (files.length > room ? `Up to ${MAX_PHOTOS} photos a post.` : null));
    if (bad) return;
    setPhotos((ps) => [...ps, ...files.slice(0, room).map((file) => ({ file, alt: "", url: URL.createObjectURL(file) }))]);
  }
  function drop(i: number) {
    URL.revokeObjectURL(photos[i].url);
    setPhotos((ps) => ps.filter((_, j) => j !== i));
    setProblem(null);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    create.mutate({ kind, body: body.trim(), photos }, {
      onSuccess: () => {
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setBody(""); setPhotos([]); setKind("update");
        field.current?.focus();
      },
    });
  }

  const empty = !body.trim() && photos.length === 0;
  const error = problem ?? (create.isError ? errorMessage(create.error) : null);
  return (
    <form onSubmit={submit} aria-labelledby="compose-title" className="air-post air-compose">
      <h2 id="compose-title" className="sr-only">Write a post</h2>
      <div className="air-compose-row">
        <MiniStamp name={name} image={image} size="l" />
        <div className="min-w-0 flex-1">
          <label htmlFor="compose-body" className="sr-only">What’s new, {first}?</label>
          <textarea ref={field} id="compose-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_POST} rows={2}
            placeholder={`What’s new in your corner of Queens, ${first}?`} className="air-compose-field" />
          <p className="air-compose-to"><Icon name="globe" className="size-3.5" />Posting to every member of the collective</p>
        </div>
      </div>

      {photos.length > 0 && (
        <ul aria-label="Photos to post" className="air-compose-photos">
          {photos.map((p, i) => (
            <li key={p.url}>
              <img src={p.url} alt="" />
              <label className="sr-only" htmlFor={`alt-${i}`}>Describe photo {i + 1} (optional)</label>
              <input id={`alt-${i}`} value={p.alt} maxLength={MAX_ALT} placeholder="Describe it (optional)" className={fieldClass}
                onChange={(e) => setPhotos((ps) => ps.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
              <button type="button" onClick={() => drop(i)} aria-label={`Remove photo ${i + 1}`} className={cn("air-compose-x", ring)}>
                <Icon name="x" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="air-post-err mt-3">{error}</p>}

      <div className="air-compose-foot">
        <fieldset className="air-kinds">
          <legend className="sr-only">What kind of post</legend>
          {FEED_KINDS.map((k) => (
            <label key={k} className="air-kind">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <Icon name={KINDS[k].icon} className="size-3.5" />{KINDS[k].label}
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-2">
          <label className={cn("air-icon-btn air-compose-add", photos.length >= MAX_PHOTOS && "is-full")}>
            <input type="file" multiple accept={AVATAR_TYPES.join(",")} onChange={pick} disabled={photos.length >= MAX_PHOTOS} className="sr-only" />
            <Icon name="image" className="size-4.5" /><span className="sr-only">Add photos (up to {MAX_PHOTOS})</span>
          </label>
          <button type="submit" disabled={empty || create.isPending} className={redButton}>
            {create.isPending ? "Posting…" : "Post"}<Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </form>
  );
}
