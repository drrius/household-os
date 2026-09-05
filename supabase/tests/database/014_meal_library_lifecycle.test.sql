begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- This adapter fixture requires the versioned routine command from migration019.
create function pg_temp.edit_prep(command_key text, patch jsonb) returns jsonb language sql as $$
 select public.edit_routine_definition(
  (current_setting('test.prep')::jsonb->>'routine_id')::uuid,
  (select updated_at from public.routines where id=(current_setting('test.prep')::jsonb->>'routine_id')::uuid),
  command_key,patch)
$$;

select ok(has_column_privilege('authenticated','public.meal_grocery_templates','archived_at','update'), 'members can archive and restore grocery templates');
select ok((select count(*) = 2 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('meal_definitions','meal_grocery_templates')), 'library meals and default groceries publish realtime changes');
select ok(not has_table_privilege('authenticated','public.meal_grocery_templates','delete'), 'members cannot permanently delete default groceries');
select ok(not has_function_privilege('anon','public.save_planned_meal_to_library(uuid,uuid,text,text,text)','execute'), 'anonymous clients cannot save a planned meal');
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000141','meal-review-one@example.invalid'),
('00000000-0000-4000-8000-000000000142','meal-review-two@example.invalid'),
('00000000-0000-4000-8000-000000000143','meal-review-outsider@example.invalid');
insert into public.households(id,name) values ('10000000-0000-4000-8000-000000000141','Meal lifecycle');
insert into public.household_members(household_id,user_id,display_name) values
('10000000-0000-4000-8000-000000000141','00000000-0000-4000-8000-000000000141','Alex'),
('10000000-0000-4000-8000-000000000141','00000000-0000-4000-8000-000000000142','Sam');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000141',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select set_config('test.meal',(public.place_meal('10000000-0000-4000-8000-000000000141','2030-08-06','dinner','freeform','review-place',null,null,'Pasta')->>'meal_plan_entry_id'),true);
select lives_ok($$select public.save_planned_meal_to_library(current_setting('test.meal')::uuid,'20000000-0000-4000-8000-000000000141','Pasta','https://example.com/recipe','Simmer gently')$$, 'saving a planned meal creates and links its definition');
select is((select meal_definition_id from public.meal_plan_entries where id=current_setting('test.meal')::uuid),'20000000-0000-4000-8000-000000000141'::uuid,'source entry points to its new library meal');
select is(public.save_planned_meal_to_library(current_setting('test.meal')::uuid,'20000000-0000-4000-8000-000000000142','Competing save')->>'meal_definition_id','20000000-0000-4000-8000-000000000141','a competing save form returns the existing definition');
select is((select count(*)::integer from public.meal_definitions),1,'repeated source saves cannot duplicate the library meal');

insert into public.meal_grocery_templates(id,household_id,meal_definition_id,name,sort_order) values
('30000000-0000-4000-8000-000000000141','10000000-0000-4000-8000-000000000141','20000000-0000-4000-8000-000000000141','Tomatoes',0),
('30000000-0000-4000-8000-000000000142','10000000-0000-4000-8000-000000000141','20000000-0000-4000-8000-000000000141','Pasta',1);
update public.meal_grocery_templates set archived_at=now() where id='30000000-0000-4000-8000-000000000142';
select set_config('test.next',(public.place_meal('10000000-0000-4000-8000-000000000141','2030-08-07','dinner','library','review-next','20000000-0000-4000-8000-000000000141')->>'meal_plan_entry_id'),true);
select is((select count(*)::integer from public.grocery_items where originating_meal_plan_entry_id=current_setting('test.next')::uuid),1,'planning excludes archived default groceries');
select is((select count(*)::integer from public.meal_grocery_templates),2,'archival retains default grocery records');
update public.meal_grocery_templates set archived_at=null where id='30000000-0000-4000-8000-000000000142';
select set_config('test.restored',(public.place_meal('10000000-0000-4000-8000-000000000141','2030-08-08','dinner','library','review-restored','20000000-0000-4000-8000-000000000141')->>'meal_plan_entry_id'),true);
select is((select count(*)::integer from public.grocery_items where originating_meal_plan_entry_id=current_setting('test.restored')::uuid),2,'restored templates return for future plans');
select public.move_meal_plan_entry(current_setting('test.meal')::uuid,'2030-08-09','dinner','review-move-source');
select is((select count(*)::integer from public.grocery_items where originating_meal_plan_entry_id=current_setting('test.meal')::uuid),0,'saving a slotted meal does not retrospectively add default groceries');
update public.meal_definitions set archived_at=now() where id='20000000-0000-4000-8000-000000000141';
select is((select count(*)::integer from public.meal_definitions where id='20000000-0000-4000-8000-000000000141'),1,'archived library meals remain readable to their household');

update public.meal_definitions set archived_at=null where id='20000000-0000-4000-8000-000000000141';
select is((select archived_at from public.meal_definitions where id='20000000-0000-4000-8000-000000000141'),null::timestamptz,'members restore saved meals without losing their definition');

select set_config('test.prep',public.create_meal_preparation(current_setting('test.meal')::uuid,'Make sauce','Simmer','2030-08-08',(select id from public.areas where name='Meals'),'shared',null,null,'review-prep')::text,true);
select lives_ok($$select pg_temp.edit_prep('014-prep-edit-1',jsonb_build_object('title','Prepare the sauce','assignment_policy','assigned','assigned_member_id','00000000-0000-4000-8000-000000000142','schedule_kind','one_off','schedule_rule','{"kind":"one_off","date":"2030-08-07"}'::jsonb,'rebuild_window',true))$$,'general routine edits preserve linked preparation');
select is((select id::text from public.routine_occurrences where meal_plan_entry_id=current_setting('test.meal')::uuid),current_setting('test.prep')::jsonb->>'occurrence_id','editing preserves the original linked occurrence identity');
select is((select due_date from public.routine_occurrences where meal_plan_entry_id=current_setting('test.meal')::uuid),'2030-08-07'::date,'prep due date can change');
select is((select planned_assignee_id from public.routine_occurrences where meal_plan_entry_id=current_setting('test.meal')::uuid),'00000000-0000-4000-8000-000000000142'::uuid,'prep assignee can change');
select lives_ok($$select pg_temp.edit_prep('014-clear-prep','{"instructions":null,"active_from":null,"active_until":null}')$$,'prep instructions can clear through the versioned command');
select ok((select instructions is null and active_from='2030-08-07' and active_until='2030-08-07' from public.routines where id=(current_setting('test.prep')::jsonb->>'routine_id')::uuid),'prep clears retain the required one-day window');
select throws_ok($$select pg_temp.edit_prep('014-prep-edit-2',jsonb_build_object('schedule_kind','after_completion','schedule_rule','{"kind":"after_completion","every":2,"unit":"days"}'::jsonb))$$,'22023','Meal preparation must remain a one-off task.','linked preparation cannot become recurring');
select public.remove_meal_plan_entry(current_setting('test.meal')::uuid,'review-remove');
select is((select title_snapshot from public.meal_plan_entries where id=current_setting('test.meal')::uuid and removed_at is not null),'Pasta','removed source remains readable with its historical title');
select is((select status from public.routine_occurrences where id=(current_setting('test.prep')::jsonb->>'occurrence_id')::uuid),'skipped','removing a meal still cancels its edited prep');
select lives_ok($$select pg_temp.edit_prep('014-prep-edit-3',jsonb_build_object('title','Finished sauce','instructions','Keep this note'))$$,'closed prep retains editable title and instructions');
select throws_ok($$select pg_temp.edit_prep('014-prep-edit-4',jsonb_build_object('schedule_rule','{"kind":"one_off","date":"2030-08-10"}'::jsonb))$$,'55000','Finished meal preparation keeps its date and assignee. You can still edit its title and instructions.','closed prep cannot be rebuilt as a second task');
select is((select count(*)::integer from public.routine_occurrences where routine_id=(current_setting('test.prep')::jsonb->>'routine_id')::uuid),1,'the meal keeps exactly one prep occurrence throughout its lifecycle');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000143',true);
select throws_ok($$select public.save_planned_meal_to_library(current_setting('test.next')::uuid,'20000000-0000-4000-8000-000000000143','Denied')$$,'42501','Not a member of this household.','outsiders cannot use an existing source link to access another household');
select throws_ok($$select pg_temp.edit_prep('014-prep-edit-5',jsonb_build_object('title','Denied'))$$,'42501','Caller cannot edit this routine','outsiders cannot edit linked preparation');
select is_empty($$update public.meal_definitions set archived_at=null where id='20000000-0000-4000-8000-000000000141' returning id$$,'outsiders cannot restore another household meal');
select is_empty($$update public.meal_grocery_templates set archived_at=null where id='30000000-0000-4000-8000-000000000142' returning id$$,'template archive grant remains household scoped');
select is((select count(*)::integer from public.meal_grocery_templates),0,'RLS hides active and archived templates from outsiders');
select * from finish();
rollback;
