-- Repair installations where the Home activity migration was applied after
-- project history and replaced its allowed event types. Preserve every installed
-- activity type while restoring the values emitted by record_project_change.
-- Extend the installed catalog so independently landed activity kinds survive.
do $$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.activity_events'::regclass and conname='activity_events_kind_check';
 if expression is null then raise exception 'Missing activity kind constraint'; end if;
 alter table public.activity_events drop constraint activity_events_kind_check;
 execute format('alter table public.activity_events add constraint activity_events_kind_check check ((%s) or kind in (''project_record_changed'',''project_task_assigned''))',expression);
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.activity_events'::regclass and conname='activity_events_entity_type_check';
 if expression is null then raise exception 'Missing activity entity constraint'; end if;
 alter table public.activity_events drop constraint activity_events_entity_type_check;
 execute format('alter table public.activity_events add constraint activity_events_entity_type_check check ((%s) or entity_type in (''household_project'',''project_task''))',expression);
end;
$$;
