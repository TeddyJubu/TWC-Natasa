-- The North Brooklyn neighborhoods from the join form's list, after whatever an admin has already added, in the colors
-- the home page already gives them. A slug or name an admin already uses is left exactly as it is.
insert into neighborhoods (slug, name, color, sort_order)
  select 'greenpoint', 'Greenpoint', '#737a4e', coalesce(max(sort_order), 0) + 1 from neighborhoods where true
  on conflict do nothing;
insert into neighborhoods (slug, name, color, sort_order)
  select 'williamsburg', 'Williamsburg', '#e6b5c1', coalesce(max(sort_order), 0) + 1 from neighborhoods where true
  on conflict do nothing;
insert into neighborhoods (slug, name, color, sort_order)
  select 'bushwick', 'Bushwick', '#b85a45', coalesce(max(sort_order), 0) + 1 from neighborhoods where true
  on conflict do nothing;
