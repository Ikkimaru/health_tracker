create table if not exists public.encrypted_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  envelope jsonb not null,
  created_at timestamptz not null default now(),
  constraint encrypted_backups_format check (envelope ->> 'format' = 'healthtracker-backup'),
  constraint encrypted_backups_max_size check (octet_length(envelope::text) <= 5242880)
);

create index if not exists encrypted_backups_user_created_idx
  on public.encrypted_backups (user_id, created_at desc);

alter table public.encrypted_backups enable row level security;

revoke all on table public.encrypted_backups from anon;
grant select, insert, delete on table public.encrypted_backups to authenticated;

create policy "Users can read their encrypted backups"
  on public.encrypted_backups for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their encrypted backups"
  on public.encrypted_backups for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their encrypted backups"
  on public.encrypted_backups for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.prune_encrypted_backups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.encrypted_backups
  where id in (
    select id
    from public.encrypted_backups
    where user_id = new.user_id
    order by created_at desc, id desc
    offset 5
  );
  return new;
end;
$$;

revoke all on function public.prune_encrypted_backups() from public, anon, authenticated;

create trigger prune_encrypted_backups_after_insert
after insert on public.encrypted_backups
for each row execute function public.prune_encrypted_backups();
