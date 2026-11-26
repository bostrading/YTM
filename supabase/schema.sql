-- YT Manager database schema (project: ciwghxpgvkdsszqezmbr)
-- The browser profile and YouTube cookies remain on the local desktop device.

create table public.yt_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  browser_profile_id uuid not null default gen_random_uuid(),
  account_status text not null default 'unknown'
    check (account_status in ('unknown','logged_in','logged_out','error')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index yt_accounts_user_created_idx on public.yt_accounts(user_id, created_at desc);

create table public.yt_activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.yt_accounts(id) on delete set null,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index yt_activity_user_created_idx on public.yt_activity_logs(user_id, created_at desc);
create index yt_activity_logs_account_id_idx on public.yt_activity_logs(account_id);

alter table public.yt_accounts enable row level security;
alter table public.yt_activity_logs enable row level security;
revoke all on table public.yt_accounts from anon, authenticated;
revoke all on table public.yt_activity_logs from anon, authenticated;
-- The admin Edge Function reads all accounts with the service-role client.
grant select on table public.yt_accounts to service_role;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.yt_accounts to authenticated;
grant select, insert, update, delete on table public.yt_activity_logs to authenticated;
grant usage, select on sequence public.yt_activity_logs_id_seq to authenticated;

create policy "yt_accounts_select_own" on public.yt_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "yt_accounts_insert_own" on public.yt_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "yt_accounts_update_own" on public.yt_accounts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "yt_accounts_delete_own" on public.yt_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "yt_activity_select_own" on public.yt_activity_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "yt_activity_insert_own" on public.yt_activity_logs
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (account_id is null or exists (
      select 1 from public.yt_accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    ))
  );
create policy "yt_activity_delete_own" on public.yt_activity_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
