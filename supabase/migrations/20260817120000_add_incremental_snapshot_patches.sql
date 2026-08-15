create function public.patch_document_array(
  original jsonb,
  changes jsonb,
  identity_key text,
  sort_by_identity boolean default false
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(items.value order by
    case when sort_by_identity then items.value ->> identity_key end,
    case when not sort_by_identity then items.position end
  ), '[]'::jsonb)
  from (
    select ordinality - 1 as position, value
    from jsonb_array_elements(coalesce(original, '[]'::jsonb)) with ordinality
    where not exists (
      select 1 from jsonb_array_elements_text(coalesce(changes -> 'deletes', '[]'::jsonb)) deleted
      where deleted = value ->> identity_key
    ) and not exists (
      select 1 from jsonb_array_elements(coalesce(changes -> 'upserts', '[]'::jsonb)) replacement
      where replacement #>> array['value', identity_key] = value ->> identity_key
    )
    union all
    select (replacement ->> 'position')::integer, replacement -> 'value'
    from jsonb_array_elements(coalesce(changes -> 'upserts', '[]'::jsonb)) replacement
  ) items;
$$;

create function public.store_app_patch(changes jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_snapshot uuid;
  document jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if (changes ->> 'schemaVersion')::integer <> 1 then
    raise exception 'Unsupported application schema';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended((select auth.uid())::text, 0)
  );

  select s.id into current_snapshot
  from public.app_snapshots s
  where s.user_id = (select auth.uid())
  order by s.created_at desc, s.id desc
  limit 1;
  if current_snapshot is null then raise exception 'A full initial snapshot is required'; end if;

  document := public.read_app_snapshot(current_snapshot);
  if changes ? 'settings' then
    document := jsonb_set(document, '{settings}', changes -> 'settings');
  end if;
  if changes ? 'exercises' then
    document := jsonb_set(document, '{exercises}', public.patch_document_array(
      document -> 'exercises', changes -> 'exercises', 'id'));
  end if;
  if changes ? 'routines' then
    document := jsonb_set(document, '{routines}', public.patch_document_array(
      document -> 'routines', changes -> 'routines', 'id'));
  end if;
  if changes ? 'sessions' then
    document := jsonb_set(document, '{sessions}', public.patch_document_array(
      document -> 'sessions', changes -> 'sessions', 'id'));
  end if;
  if changes ? 'weights' then
    document := jsonb_set(document, '{weights}', public.patch_document_array(
      document -> 'weights', changes -> 'weights', 'date', true));
  end if;

  return public.store_app_snapshot(document);
end;
$$;

grant execute on function public.store_app_patch(jsonb) to authenticated;
revoke all on function public.store_app_patch(jsonb) from public, anon;
revoke all on function public.patch_document_array(jsonb, jsonb, text, boolean)
  from public, anon, authenticated;
