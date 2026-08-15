create table public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('developer', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_user_roles enable row level security;
revoke all on table public.app_user_roles from public, anon, authenticated;

create function public.get_my_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'user'
    else coalesce((
      select role from public.app_user_roles where user_id = (select auth.uid())
    ), 'user')
  end;
$$;

create function public.list_registered_app_users()
returns table (user_id uuid, email text, role text, registered_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_user_roles
    where user_id = (select auth.uid()) and role = 'developer'
  ) then
    raise exception 'Developer access required';
  end if;

  return query
  select users.id, users.email::text, coalesce(roles.role, 'user'), users.created_at
  from auth.users as users
  left join public.app_user_roles as roles on roles.user_id = users.id
  order by users.created_at desc, users.id;
end;
$$;

grant execute on function public.get_my_app_role() to authenticated;
grant execute on function public.list_registered_app_users() to authenticated;
revoke all on function public.get_my_app_role() from public, anon;
revoke all on function public.list_registered_app_users() from public, anon;
