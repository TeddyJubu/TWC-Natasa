-- The members' newsfeed (/feed; DESIGN.md "Newsfeed"): posts, loves and replies. Only approved members and admins read
-- or write them (requireMember in src/features/feed/feed.server.ts); a member deletes her own, an admin any. No edit.
-- Everything hangs off profiles, so a deleted account takes her posts, loves and replies with it.
create table feed_posts (
  id text primary key,
  author_id text not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('update', 'ask', 'offer', 'gathering')),
  body text not null check (length(body) <= 5000),
  -- Up to four photos in her folder of the private `feed` bucket: [{"name": "<author id>/<post id>-<n>.<ext>", "alt": "…"}].
  photos text not null default '[]' check (json_valid(photos) and json_type(photos) = 'array' and json_array_length(photos) <= 4),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Words, a photo, or both: never an empty post.
  check (length(trim(body)) > 0 or json_array_length(photos) > 0)
);
create index feed_posts_newest on feed_posts (created_at desc, id desc);
create index feed_posts_author on feed_posts (author_id);

-- One love per member per post.
create table feed_loves (
  post_id text not null references feed_posts (id) on delete cascade,
  member_id text not null references profiles (id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (post_id, member_id)
) without rowid;

create table feed_replies (
  id text primary key,
  post_id text not null references feed_posts (id) on delete cascade,
  author_id text not null references profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index feed_replies_post on feed_replies (post_id, created_at);
