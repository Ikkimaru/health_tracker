create or replace function public.prune_app_snapshots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_snapshots
  where id in (
    select id from public.app_snapshots where user_id = new.user_id
    order by created_at desc, id desc offset 2
  );
  return new;
end;
$$;

revoke all on function public.prune_app_snapshots() from public, anon, authenticated;
