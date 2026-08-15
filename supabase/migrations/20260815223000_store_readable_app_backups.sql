create table if not exists public.app_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  constraint app_backups_schema check ((data ->> 'schemaVersion')::integer = 1),
  constraint app_backups_max_size check (octet_length(data::text) <= 5242880)
);

create index if not exists app_backups_user_created_idx
  on public.app_backups (user_id, created_at desc);

alter table public.app_backups enable row level security;

revoke all on table public.app_backups from anon;
grant select, insert, delete on table public.app_backups to authenticated;

create policy "Users can read their app backups"
  on public.app_backups for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their app backups"
  on public.app_backups for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their app backups"
  on public.app_backups for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.prune_app_backups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_backups
  where id in (
    select id
    from public.app_backups
    where user_id = new.user_id
    order by created_at desc, id desc
    offset 5
  );
  return new;
end;
$$;

revoke all on function public.prune_app_backups() from public, anon, authenticated;

create trigger prune_app_backups_after_insert
after insert on public.app_backups
for each row execute function public.prune_app_backups();
