-- Enforce name length at DB level (matches app limit in whiteboards.ts).
alter table public.whiteboards
  add constraint whiteboards_name_length check (char_length(name) <= 200);
