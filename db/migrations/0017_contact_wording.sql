-- The contact page's default no longer names one area. form_copy is keyed by a text's default wording, so the row is
-- re-keyed here; without this, an admin's saved edit of it would silently stop showing.
update form_copy
  set original = 'A question about membership, an idea for an event, a partnership you’d like to explore: send it our way. A real person reads every message.'
  where form = 'contact'
    and original = 'A question about membership, an idea for an event, a partnership you’d like to explore: send it our way. A real person in North Brooklyn reads every message.';
