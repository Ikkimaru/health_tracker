alter table public.routine_items
  drop constraint routine_items_snapshot_id_exercise_id_fkey,
  add constraint routine_items_snapshot_id_exercise_id_fkey
    foreign key (snapshot_id, exercise_id)
    references public.exercises(snapshot_id, id)
    on delete no action
    deferrable initially deferred;

alter table public.daily_session_routines
  drop constraint daily_session_routines_snapshot_id_routine_id_fkey,
  add constraint daily_session_routines_snapshot_id_routine_id_fkey
    foreign key (snapshot_id, routine_id)
    references public.routines(snapshot_id, id)
    on delete no action
    deferrable initially deferred;

alter table public.session_exercises
  drop constraint session_exercises_snapshot_id_source_exercise_id_fkey,
  add constraint session_exercises_snapshot_id_source_exercise_id_fkey
    foreign key (snapshot_id, source_exercise_id)
    references public.exercises(snapshot_id, id)
    on delete no action
    deferrable initially deferred;
