begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000321','leftover-dates-one@example.invalid'),
('00000000-0000-4000-8000-000000000322','leftover-dates-other@example.invalid');
insert into public.households(id,name) values ('10000000-0000-4000-8000-000000000321','Leftover dates');
insert into public.household_members(household_id,user_id,display_name) values
('10000000-0000-4000-8000-000000000321','00000000-0000-4000-8000-000000000321','Alex');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000321',true);
set local role authenticated;
select set_config('test.source',public.place_meal('10000000-0000-4000-8000-000000000321','2030-08-01','dinner','freeform','032-source',null,null,'Pasta')->>'meal_plan_entry_id',true);
select set_config('test.leftover',public.place_meal('10000000-0000-4000-8000-000000000321','2030-08-03','lunch','leftover','032-leftover',null,current_setting('test.source')::uuid)->>'meal_plan_entry_id',true);
select throws_ok($$select public.move_meal_plan_entry(current_setting('test.source')::uuid,'2030-08-03','dinner','032-invalid-source')$$,'23514','move would place a leftover before its source','source cannot move onto its leftover date');
select throws_ok($$select public.move_meal_plan_entry(current_setting('test.leftover')::uuid,'2030-08-01','lunch','032-invalid-child')$$,'23514','leftover source must be earlier than the target entry','leftover moves recheck the locked source date');
select lives_ok($$select public.move_meal_plan_entry(current_setting('test.source')::uuid,'2030-08-02','dinner','032-valid-source')$$,'source can move while preserving the ordering');
select throws_ok($$select public.place_meal('10000000-0000-4000-8000-000000000321','2030-08-02','lunch','leftover','032-invalid-placement',null,current_setting('test.source')::uuid)$$,'22023','leftover source must be earlier than the target entry','new placement checks the current source date');
reset role;
select throws_ok($$update public.meal_plan_entries set date='2030-08-03' where id=current_setting('test.source')::uuid$$,'23514','source change would invalidate an existing leftover','the trigger also protects source updates outside the move command');
select is((select date from public.meal_plan_entries where id=current_setting('test.source')::uuid),'2030-08-02'::date,'rejected source changes preserve its accepted date');
select is((select date from public.meal_plan_entries where id=current_setting('test.leftover')::uuid),'2030-08-03'::date,'rejected leftover changes preserve its accepted date');
select is_empty($$select child.id from public.meal_plan_entries child join public.meal_plan_entries source on source.id=child.leftover_of_entry_id where child.removed_at is null and (source.date>=child.date or source.leftover_of_entry_id is not null)$$,'all active leftovers retain a strictly earlier direct source');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000322',true);
set local role authenticated;
select throws_ok($$select public.place_meal('10000000-0000-4000-8000-000000000321','2030-08-04','lunch','leftover','032-foreign',null,current_setting('test.source')::uuid)$$,'42501','caller is not a member of household 10000000-0000-4000-8000-000000000321','foreign callers cannot place leftovers from this household');
select * from finish();
rollback;
