begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id, email) values
 ('00000000-0000-4000-8000-000000000071', 'cancel-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000072', 'cancel-b@example.invalid'),
 ('00000000-0000-4000-8000-000000000073', 'cancel-outsider@example.invalid');
insert into public.households(id,name) values ('10000000-0000-4000-8000-000000000071','Cancellation test');
insert into public.household_members(household_id,user_id,display_name) values
 ('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071','A'),
 ('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000072','B');
insert into public.shopping_sessions(id,household_id,member_id) values
 ('20000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071'),
 ('20000000-0000-4000-8000-000000000072','10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000072');
insert into public.grocery_items(id,household_id,name,sort_order,state,claimed_by_session_id) values
 ('30000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000071','A cart',0,'claimed','20000000-0000-4000-8000-000000000071'),
 ('30000000-0000-4000-8000-000000000072','10000000-0000-4000-8000-000000000071','B cart',1,'claimed','20000000-0000-4000-8000-000000000072');
insert into public.shopping_session_items(household_id,shopping_session_id,grocery_item_id) values
 ('10000000-0000-4000-8000-000000000071','20000000-0000-4000-8000-000000000071','30000000-0000-4000-8000-000000000071'),
 ('10000000-0000-4000-8000-000000000071','20000000-0000-4000-8000-000000000072','30000000-0000-4000-8000-000000000072');
select ok(not has_function_privilege('anon','public.cancel_shopping_session(uuid)','execute'),'anonymous cancellation unavailable');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000073',true);
select throws_ok($$select public.cancel_shopping_session('20000000-0000-4000-8000-000000000071')$$,'42501',null,'outsider cannot cancel');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select throws_ok($$select public.cancel_shopping_session('20000000-0000-4000-8000-000000000071')$$,'42501',null,'partner cannot cancel another cart');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select is((public.cancel_shopping_session('20000000-0000-4000-8000-000000000071')->>'released_item_count')::integer,1,'owner can release own cart');
select is((select state from public.grocery_items where id='30000000-0000-4000-8000-000000000071'),'active','cancelled item returns to list');
select is((select state from public.grocery_items where id='30000000-0000-4000-8000-000000000072'),'claimed','partner cart stays claimed');
select ok((select finished_at is not null from public.shopping_sessions where id='20000000-0000-4000-8000-000000000071'),'cancelled session closed');
select ok((select finished_at is null from public.shopping_sessions where id='20000000-0000-4000-8000-000000000072'),'partner session stays open');
select is((select count(*)::integer from public.shopping_session_items where shopping_session_id='20000000-0000-4000-8000-000000000071'),0,'cancelled claims no longer link to session');
select is((public.cancel_shopping_session('20000000-0000-4000-8000-000000000071')->>'released_item_count')::integer,0,'cancellation retry is idempotent');
select is((select count(*)::integer from public.expense_drafts),0,'cancellation creates no expense');
select lives_ok($$select public.start_shopping_session('10000000-0000-4000-8000-000000000071')$$,'owner can start a fresh empty session');
select lives_ok($$select public.cancel_shopping_session(id) from public.shopping_sessions where member_id=auth.uid() and finished_at is null$$,'empty session can be cancelled');
select is((select count(*)::integer from public.shopping_sessions where member_id=auth.uid() and finished_at is null),0,'no abandoned empty active session');
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grocery_categories'),'category changes are published to shared clients');
select * from finish();
rollback;
