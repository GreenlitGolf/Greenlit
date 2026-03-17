-- Waitlist email capture
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  source     text default 'waitlist_page',
  created_at timestamptz default now()
);

-- Allow inserts from anon (public page, no auth)
alter table waitlist enable row level security;

create policy "Anyone can insert waitlist"
  on waitlist for insert
  with check (true);

-- Only service role / admin can read
create policy "Service role can read waitlist"
  on waitlist for select
  using (auth.role() = 'service_role');
