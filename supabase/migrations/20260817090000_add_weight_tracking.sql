alter table public.app_settings
  add column goal_weight_kg numeric,
  add column goal_weight_deadline date,
  add column weight_calendar_week_start text not null default 'monday'
    check (weight_calendar_week_start in ('sunday', 'monday')),
  add column weight_trend_method text not null default 'linear'
    check (weight_trend_method in ('linear', 'weighted', 'theil-sen'));

create table public.weight_entries (
  snapshot_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg <= 1000),
  primary key (snapshot_id, entry_date),
  constraint weight_entries_owner foreign key (snapshot_id, user_id)
    references public.app_snapshots(id, user_id) on delete cascade
);

alter table public.weight_entries enable row level security;
revoke all on table public.weight_entries from anon, authenticated;
create policy "Users own weight entries" on public.weight_entries
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter function public.store_app_snapshot(jsonb) rename to store_app_snapshot_before_weights;
alter function public.read_app_snapshot(uuid) rename to read_app_snapshot_before_weights;

create function public.store_app_snapshot(document jsonb) returns uuid language plpgsql
security definer set search_path = '' as $$
declare snapshot uuid; owner uuid := (select auth.uid());
begin
  snapshot := public.store_app_snapshot_before_weights(document);
  update public.app_settings set
    goal_weight_kg = (document #>> '{settings,goalWeightKg}')::numeric,
    goal_weight_deadline = (document #>> '{settings,goalWeightDeadline}')::date,
    weight_calendar_week_start = coalesce(
      document #>> '{settings,weightCalendarWeekStart}', 'monday'
    ),
    weight_trend_method = coalesce(document #>> '{settings,weightTrendMethod}', 'linear')
  where snapshot_id = snapshot;
  insert into public.weight_entries (snapshot_id, user_id, entry_date, weight_kg)
  select snapshot, owner, (entry ->> 'date')::date, (entry ->> 'weightKg')::numeric
  from jsonb_array_elements(coalesce(document -> 'weights', '[]'::jsonb)) as values(entry);
  return snapshot;
end; $$;

create function public.read_app_snapshot(snapshot uuid) returns jsonb language sql stable
security definer set search_path = '' as $$
  select public.read_app_snapshot_before_weights(snapshot) || jsonb_build_object(
    'settings', (public.read_app_snapshot_before_weights(snapshot) -> 'settings')
      || jsonb_strip_nulls(jsonb_build_object(
        'goalWeightKg', settings.goal_weight_kg,
        'goalWeightDeadline', to_char(settings.goal_weight_deadline, 'YYYY-MM-DD'),
        'weightCalendarWeekStart', settings.weight_calendar_week_start,
        'weightTrendMethod', settings.weight_trend_method)),
    'weights', coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(w.entry_date, 'YYYY-MM-DD'), 'weightKg', w.weight_kg
    ) order by w.entry_date) from public.weight_entries w
      where w.snapshot_id = snapshot), '[]'::jsonb))
  from public.app_settings settings
  join public.app_snapshots snapshots on snapshots.id = settings.snapshot_id
  where settings.snapshot_id = snapshot and snapshots.user_id = (select auth.uid());
$$;

grant execute on function public.store_app_snapshot(jsonb) to authenticated;
grant execute on function public.read_app_snapshot(uuid) to authenticated;
revoke all on function public.store_app_snapshot(jsonb) from public, anon;
revoke all on function public.read_app_snapshot(uuid) from public, anon;
revoke all on function public.store_app_snapshot_before_weights(jsonb) from public, anon, authenticated;
revoke all on function public.read_app_snapshot_before_weights(uuid) from public, anon, authenticated;

create or replace function public.download_latest_app_snapshot()
returns table (id uuid, created_at timestamptz, data jsonb) language sql stable
security definer set search_path = '' as $$
  select s.id, s.created_at, public.read_app_snapshot(s.id)
  from public.app_snapshots s where s.user_id = (select auth.uid())
  order by s.created_at desc, s.id desc limit 1;
$$;
