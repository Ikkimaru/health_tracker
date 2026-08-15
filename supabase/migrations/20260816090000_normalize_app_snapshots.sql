create table public.app_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.app_settings (
  snapshot_id uuid primary key references public.app_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  theme text not null check (theme in ('system', 'light', 'dark', 'custom')),
  custom_theme jsonb,
  constraint app_settings_owner foreign key (snapshot_id, user_id)
    references public.app_snapshots(id, user_id) on delete cascade
);

create table public.exercises (
  snapshot_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null check (position >= 0),
  name text not null,
  measurement_kind text not null check (measurement_kind in ('reps', 'duration', 'distance')),
  sets integer not null,
  target numeric not null,
  weight_kg numeric,
  notes text,
  archived boolean not null,
  created_at timestamptz not null,
  primary key (snapshot_id, id),
  unique (snapshot_id, position),
  constraint exercises_owner foreign key (snapshot_id, user_id)
    references public.app_snapshots(id, user_id) on delete cascade
);

create table public.routines (
  snapshot_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null check (position >= 0),
  name text not null,
  archived boolean not null,
  created_at timestamptz not null,
  primary key (snapshot_id, id),
  unique (snapshot_id, position),
  constraint routines_owner foreign key (snapshot_id, user_id)
    references public.app_snapshots(id, user_id) on delete cascade
);

create table public.routine_items (
  snapshot_id uuid not null,
  routine_id text not null,
  id text not null,
  position integer not null check (position >= 0),
  exercise_id text not null,
  required boolean not null,
  sets integer,
  target numeric,
  weight_kg numeric,
  primary key (snapshot_id, routine_id, id),
  unique (snapshot_id, routine_id, position),
  foreign key (snapshot_id, routine_id) references public.routines(snapshot_id, id)
    on delete cascade,
  foreign key (snapshot_id, exercise_id) references public.exercises(snapshot_id, id)
    on delete restrict
);

create table public.routine_weekdays (
  snapshot_id uuid not null,
  routine_id text not null,
  position integer not null check (position >= 0),
  weekday integer not null check (weekday between 0 and 6),
  primary key (snapshot_id, routine_id, position),
  foreign key (snapshot_id, routine_id) references public.routines(snapshot_id, id)
    on delete cascade
);

create table public.routine_dates (
  snapshot_id uuid not null,
  routine_id text not null,
  position integer not null check (position >= 0),
  scheduled_date date not null,
  primary key (snapshot_id, routine_id, position),
  foreign key (snapshot_id, routine_id) references public.routines(snapshot_id, id)
    on delete cascade
);

create table public.daily_sessions (
  snapshot_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null check (position >= 0),
  session_date date not null,
  created_at timestamptz not null,
  primary key (snapshot_id, id),
  unique (snapshot_id, position),
  constraint daily_sessions_owner foreign key (snapshot_id, user_id)
    references public.app_snapshots(id, user_id) on delete cascade
);

create table public.daily_session_routines (
  snapshot_id uuid not null,
  session_id text not null,
  position integer not null check (position >= 0),
  routine_id text not null,
  primary key (snapshot_id, session_id, position),
  foreign key (snapshot_id, session_id) references public.daily_sessions(snapshot_id, id)
    on delete cascade,
  foreign key (snapshot_id, routine_id) references public.routines(snapshot_id, id)
    on delete restrict
);

create table public.session_exercises (
  snapshot_id uuid not null,
  session_id text not null,
  id text not null,
  position integer not null check (position >= 0),
  source_exercise_id text not null,
  name text not null,
  measurement_kind text not null check (measurement_kind in ('reps', 'duration', 'distance')),
  required boolean not null,
  weight_kg numeric,
  notes text,
  completed_at timestamptz,
  primary key (snapshot_id, session_id, id),
  unique (snapshot_id, session_id, position),
  foreign key (snapshot_id, session_id) references public.daily_sessions(snapshot_id, id)
    on delete cascade,
  foreign key (snapshot_id, source_exercise_id) references public.exercises(snapshot_id, id)
    on delete restrict
);

create table public.session_prescriptions (
  snapshot_id uuid not null,
  session_id text not null,
  session_exercise_id text not null,
  id text not null,
  position integer not null check (position >= 0),
  target numeric not null,
  completed boolean not null,
  primary key (snapshot_id, session_id, session_exercise_id, id),
  unique (snapshot_id, session_id, session_exercise_id, position),
  foreign key (snapshot_id, session_id, session_exercise_id)
    references public.session_exercises(snapshot_id, session_id, id) on delete cascade
);

create index app_snapshots_user_created_idx
  on public.app_snapshots (user_id, created_at desc, id desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_snapshots', 'app_settings', 'exercises', 'routines', 'routine_items',
    'routine_weekdays', 'routine_dates', 'daily_sessions', 'daily_session_routines',
    'session_exercises', 'session_prescriptions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

grant select, delete on table public.app_snapshots to authenticated;

create policy "Users own app snapshots" on public.app_snapshots
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users own app settings" on public.app_settings
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users own exercises" on public.exercises
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users own routines" on public.routines
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users own daily sessions" on public.daily_sessions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users access owned routine items" on public.routine_items
  for all to authenticated using (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  ));
create policy "Users access owned routine weekdays" on public.routine_weekdays
  for all to authenticated using (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  ));
create policy "Users access owned routine dates" on public.routine_dates
  for all to authenticated using (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  ));
create policy "Users access owned session routines" on public.daily_session_routines
  for all to authenticated using (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  ));
create policy "Users access owned session exercises" on public.session_exercises
  for all to authenticated using (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  ));
create policy "Users access owned prescriptions" on public.session_prescriptions
  for all to authenticated using (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.app_snapshots s
    where s.id = snapshot_id and s.user_id = (select auth.uid())
  ));

create function public.store_app_snapshot(document jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot uuid;
  owner uuid := (select auth.uid());
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if (document ->> 'schemaVersion')::integer <> 1 then
    raise exception 'Unsupported application schema';
  end if;
  if octet_length(document::text) > 5242880 then raise exception 'Snapshot is too large'; end if;

  insert into public.app_snapshots (user_id) values (owner) returning id into snapshot;
  insert into public.app_settings (snapshot_id, user_id, display_name, theme, custom_theme)
  values (
    snapshot, owner, document #>> '{settings,displayName}', document #>> '{settings,theme}',
    document #> '{settings,customTheme}'
  );

  insert into public.exercises
    (snapshot_id, user_id, id, position, name, measurement_kind, sets, target,
     weight_kg, notes, archived, created_at)
  select snapshot, owner, item ->> 'id', ordinality - 1, item ->> 'name', item ->> 'kind',
    (item ->> 'sets')::integer, (item ->> 'target')::numeric,
    (item ->> 'weightKg')::numeric, item ->> 'notes', (item ->> 'archived')::boolean,
    (item ->> 'createdAt')::timestamptz
  from jsonb_array_elements(document -> 'exercises') with ordinality as value(item, ordinality);

  insert into public.routines (snapshot_id, user_id, id, position, name, archived, created_at)
  select snapshot, owner, item ->> 'id', ordinality - 1, item ->> 'name',
    (item ->> 'archived')::boolean, (item ->> 'createdAt')::timestamptz
  from jsonb_array_elements(document -> 'routines') with ordinality as value(item, ordinality);

  insert into public.routine_items
    (snapshot_id, routine_id, id, position, exercise_id, required, sets, target, weight_kg)
  select snapshot, routine ->> 'id', item ->> 'id', item_position - 1,
    item ->> 'exerciseId', (item ->> 'required')::boolean, (item ->> 'sets')::integer,
    (item ->> 'target')::numeric, (item ->> 'weightKg')::numeric
  from jsonb_array_elements(document -> 'routines') as routines(routine)
  cross join lateral jsonb_array_elements(routine -> 'items') with ordinality
    as items(item, item_position);

  insert into public.routine_weekdays (snapshot_id, routine_id, position, weekday)
  select snapshot, routine ->> 'id', weekday_position - 1, weekday::integer
  from jsonb_array_elements(document -> 'routines') as routines(routine)
  cross join lateral jsonb_array_elements_text(routine #> '{schedule,weekdays}') with ordinality
    as weekdays(weekday, weekday_position);

  insert into public.routine_dates (snapshot_id, routine_id, position, scheduled_date)
  select snapshot, routine ->> 'id', date_position - 1, scheduled_date::date
  from jsonb_array_elements(document -> 'routines') as routines(routine)
  cross join lateral jsonb_array_elements_text(routine #> '{schedule,dates}') with ordinality
    as dates(scheduled_date, date_position);

  insert into public.daily_sessions
    (snapshot_id, user_id, id, position, session_date, created_at)
  select snapshot, owner, session ->> 'id', ordinality - 1, (session ->> 'date')::date,
    (session ->> 'createdAt')::timestamptz
  from jsonb_array_elements(document -> 'sessions') with ordinality as value(session, ordinality);

  insert into public.daily_session_routines (snapshot_id, session_id, position, routine_id)
  select snapshot, session ->> 'id', routine_position - 1, routine_id
  from jsonb_array_elements(document -> 'sessions') as sessions(session)
  cross join lateral jsonb_array_elements_text(session -> 'routineIds') with ordinality
    as routines(routine_id, routine_position);

  insert into public.session_exercises
    (snapshot_id, session_id, id, position, source_exercise_id, name, measurement_kind,
     required, weight_kg, notes, completed_at)
  select snapshot, session ->> 'id', exercise ->> 'id', exercise_position - 1,
    exercise ->> 'sourceExerciseId', exercise ->> 'name', exercise ->> 'kind',
    (exercise ->> 'required')::boolean, (exercise ->> 'weightKg')::numeric,
    exercise ->> 'notes', (exercise ->> 'completedAt')::timestamptz
  from jsonb_array_elements(document -> 'sessions') as sessions(session)
  cross join lateral jsonb_array_elements(session -> 'exercises') with ordinality
    as exercises(exercise, exercise_position);

  insert into public.session_prescriptions
    (snapshot_id, session_id, session_exercise_id, id, position, target, completed)
  select snapshot, session ->> 'id', exercise ->> 'id', prescription ->> 'id',
    prescription_position - 1, (prescription ->> 'target')::numeric,
    (prescription ->> 'completed')::boolean
  from jsonb_array_elements(document -> 'sessions') as sessions(session)
  cross join lateral jsonb_array_elements(session -> 'exercises') as exercises(exercise)
  cross join lateral jsonb_array_elements(exercise -> 'prescriptions') with ordinality
    as prescriptions(prescription, prescription_position);

  return snapshot;
end;
$$;

create function public.read_app_snapshot(snapshot uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', s.schema_version,
    'settings', jsonb_strip_nulls(jsonb_build_object(
      'displayName', settings.display_name,
      'theme', settings.theme,
      'customTheme', settings.custom_theme
    )),
    'exercises', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', e.id, 'name', e.name, 'kind', e.measurement_kind, 'sets', e.sets,
      'target', e.target, 'weightKg', e.weight_kg, 'notes', e.notes,
      'archived', e.archived, 'createdAt', to_char(e.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) order by e.position) from public.exercises e where e.snapshot_id = s.id), '[]'::jsonb),
    'routines', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', r.id, 'name', r.name,
      'items', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', i.id, 'exerciseId', i.exercise_id, 'required', i.required, 'sets', i.sets,
        'target', i.target, 'weightKg', i.weight_kg
      )) order by i.position) from public.routine_items i
        where i.snapshot_id = r.snapshot_id and i.routine_id = r.id), '[]'::jsonb),
      'schedule', jsonb_build_object(
        'weekdays', coalesce((select jsonb_agg(w.weekday order by w.position)
          from public.routine_weekdays w where w.snapshot_id = r.snapshot_id
          and w.routine_id = r.id), '[]'::jsonb),
        'dates', coalesce((select jsonb_agg(to_char(d.scheduled_date, 'YYYY-MM-DD') order by d.position)
          from public.routine_dates d where d.snapshot_id = r.snapshot_id
          and d.routine_id = r.id), '[]'::jsonb)
      ),
      'archived', r.archived, 'createdAt', to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) order by r.position) from public.routines r where r.snapshot_id = s.id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ds.id, 'date', to_char(ds.session_date, 'YYYY-MM-DD'),
      'routineIds', coalesce((select jsonb_agg(sr.routine_id order by sr.position)
        from public.daily_session_routines sr where sr.snapshot_id = ds.snapshot_id
        and sr.session_id = ds.id), '[]'::jsonb),
      'exercises', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', se.id, 'sourceExerciseId', se.source_exercise_id, 'name', se.name,
        'kind', se.measurement_kind, 'required', se.required, 'weightKg', se.weight_kg,
        'notes', se.notes,
        'prescriptions', coalesce((select jsonb_agg(jsonb_build_object(
          'id', p.id, 'target', p.target, 'completed', p.completed
        ) order by p.position) from public.session_prescriptions p
          where p.snapshot_id = se.snapshot_id and p.session_id = se.session_id
          and p.session_exercise_id = se.id), '[]'::jsonb),
        'completedAt', case when se.completed_at is null then null
          else to_char(se.completed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
      )) order by se.position) from public.session_exercises se
        where se.snapshot_id = ds.snapshot_id and se.session_id = ds.id), '[]'::jsonb),
      'createdAt', to_char(ds.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) order by ds.position) from public.daily_sessions ds where ds.snapshot_id = s.id), '[]'::jsonb)
  )
  from public.app_snapshots s
  join public.app_settings settings on settings.snapshot_id = s.id
  where s.id = snapshot and s.user_id = (select auth.uid());
$$;

create function public.download_latest_app_snapshot()
returns table (id uuid, created_at timestamptz, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.created_at, public.read_app_snapshot(s.id)
  from public.app_snapshots s
  where s.user_id = (select auth.uid())
  order by s.created_at desc, s.id desc
  limit 1;
$$;

grant execute on function public.store_app_snapshot(jsonb) to authenticated;
grant execute on function public.read_app_snapshot(uuid) to authenticated;
grant execute on function public.download_latest_app_snapshot() to authenticated;
revoke all on function public.store_app_snapshot(jsonb) from public, anon;
revoke all on function public.read_app_snapshot(uuid) from public, anon;
revoke all on function public.download_latest_app_snapshot() from public, anon;

do $$
declare
  backup record;
  migrated_snapshot uuid;
begin
  for backup in select id, user_id, data, created_at from public.app_backups loop
    perform set_config('request.jwt.claim.sub', backup.user_id::text, true);
    migrated_snapshot := public.store_app_snapshot(backup.data);
    update public.app_snapshots
      set created_at = backup.created_at
      where id = migrated_snapshot;
  end loop;
end;
$$;

create function public.prune_app_snapshots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_snapshots
  where id in (
    select id from public.app_snapshots where user_id = new.user_id
    order by created_at desc, id desc offset 5
  );
  return new;
end;
$$;

revoke all on function public.prune_app_snapshots() from public, anon, authenticated;
create trigger prune_app_snapshots_after_insert
after insert on public.app_snapshots
for each row execute function public.prune_app_snapshots();

drop table public.app_backups;
drop function public.prune_app_backups();
drop table public.encrypted_backups;
drop function public.prune_encrypted_backups();
