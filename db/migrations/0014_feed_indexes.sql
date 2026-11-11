-- Indexes for the newsfeed's member-side foreign keys (0013 indexed only the post side): deleting a profile cascades
-- through feed_loves.member_id and feed_replies.author_id, and her tally counts by them, without a full scan.
create index feed_loves_member on feed_loves (member_id);
create index feed_replies_author on feed_replies (author_id);
