-- The colour of her member pass, the card "View public card" opens on /account. Hers to choose, from a fixed
-- palette (the kit's mustard, rose, lilac and mint); shown only on her own page for now.
alter table profiles add column card_color text not null default 'mustard'
  check (card_color in ('mustard', 'rose', 'lilac', 'mint'));
