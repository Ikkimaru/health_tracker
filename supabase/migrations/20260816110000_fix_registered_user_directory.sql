create or replace function public.list_registered_app_users()
returns table (user_id uuid, email text, role text, registered_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.app_user_roles as current_user_role
    where current_user_role.user_id = (select auth.uid())
      and current_user_role.role = 'developer'
  ) then
    raise exception 'Developer access required';
  end if;

  return query
  select
    registered_user.id,
    registered_user.email::text,
    coalesce(registered_user_role.role, 'user'),
    registered_user.created_at
  from auth.users as registered_user
  left join public.app_user_roles as registered_user_role
    on registered_user_role.user_id = registered_user.id
  order by registered_user.created_at desc, registered_user.id;
end;
$$;

grant execute on function public.list_registered_app_users() to authenticated;
revoke all on function public.list_registered_app_users() from public, anon;
