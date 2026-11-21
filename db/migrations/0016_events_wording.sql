-- The site now says "events". form_copy is keyed by a text's default wording, so two defaults that changed are
-- re-keyed here; without this, an admin's saved edit of either would silently stop showing.
update form_copy
  set original = 'A question about membership, an idea for an event, a partnership you’d like to explore: send it our way. A real person in North Brooklyn reads every message.'
  where form = 'contact'
    and original = 'A question about membership, an idea for a gathering, a partnership you’d like to explore: send it our way. A real person in North Brooklyn reads every message.';

update form_copy
  set original = 'Every event happens because someone opens their doors and shares what they know. That’s a collaboration, and we treat it like one.'
  where form = 'partnership'
    and original = 'Every gathering happens because someone opens their doors and shares what they know. That’s a collaboration, and we treat it like one.';
