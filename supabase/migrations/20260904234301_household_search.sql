-- Household text search stays inside Postgres and the caller's household.
-- Expression GIN indexes cover meaningful text; private paths, ICS and credentials are excluded.
create index routines_search_idx on public.routines using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(instructions,'')));
create index meal_plan_entries_search_idx on public.meal_plan_entries using gin (to_tsvector('simple'::regconfig,coalesce(title_snapshot,'') || ' ' || coalesce(notes,'')));
create index meal_definitions_search_idx on public.meal_definitions using gin (to_tsvector('simple'::regconfig,coalesce(name,'') || ' ' || coalesce(notes,'')));
create index grocery_items_search_idx on public.grocery_items using gin (to_tsvector('simple'::regconfig,coalesce(name,'') || ' ' || coalesce(note,'') || ' ' || coalesce(quantity,'') || ' ' || coalesce(unit,'')));
create index financial_events_search_idx on public.financial_events using gin (to_tsvector('simple'::regconfig,coalesce(description,'') || ' ' || coalesce(note,'')));
create index household_projects_search_idx on public.household_projects using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(destination,'')));
create index project_tasks_search_idx on public.project_tasks using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(section,'')));
create index trip_bookings_search_idx on public.trip_bookings using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(origin,'') || ' ' || coalesce(destination,'') || ' ' || coalesce(confirmation,'')));
create index calendar_events_search_idx on public.calendar_events using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(location,'')));
create index household_assets_search_idx on public.household_assets using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(category,'') || ' ' || coalesce(model,'') || ' ' || coalesce(serial_number,'')));
create index household_contacts_search_idx on public.household_contacts using gin (to_tsvector('simple'::regconfig,coalesce(name,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(company,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')));
create index household_commitments_search_idx on public.household_commitments using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(provider,'')));
create index household_decisions_search_idx on public.household_decisions using gin (to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(notes,'')));
create index household_documents_search_idx on public.household_documents using gin (to_tsvector('simple'::regconfig,coalesce(title,'')));
create function public.search_household(
 p_query text,p_types text[] default null,p_include_archived boolean default false,
 p_page_size integer default 25,p_after_score integer default null,p_after_kind text default null,p_after_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tenant uuid; terms text[]; query tsquery; normalized text; result jsonb;
allowed constant text[]:=array['routine','occurrence','meal','meal_library','grocery','money','project','trip','booking','task','calendar','asset','contact','commitment','decision','document'];
begin
 select household_id into tenant from public.household_members where user_id=auth.uid();
 if auth.uid() is null or tenant is null then raise exception 'household access denied' using errcode='42501'; end if;
 normalized:=trim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g'));
 if length(normalized)>120 or p_page_size is null or p_page_size not between 1 and 50 or p_include_archived is null or (p_types is not null and (cardinality(p_types)=0 or cardinality(p_types)>16 or array_position(p_types,null) is not null or not p_types<@allowed)) then raise exception 'invalid household search' using errcode='22023'; end if;
 if num_nonnulls(p_after_score,p_after_kind,p_after_id) not in(0,3) or p_after_score<0 or (p_after_kind is not null and not p_after_kind=any(allowed)) then raise exception 'invalid search cursor' using errcode='22023'; end if;
 if length(normalized)<2 then return jsonb_build_object('total_count','0','results','[]'::jsonb,'next_cursor',null); end if;
 -- Tokenize as plain text first. Quoted lexemes cannot inject tsquery operators.
 terms:=tsvector_to_array(to_tsvector('simple'::regconfig,normalized));
 if cardinality(terms)=0 then return jsonb_build_object('total_count','0','results','[]'::jsonb,'next_cursor',null); end if;
 select to_tsquery('simple'::regconfig,string_agg(quote_literal(term)||':*',' & ')) into query from unnest(terms) term;
 with sources as not materialized (
select 'routine'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.instructions,'') body,coalesce(a.name,'') || ' ' || coalesce(p.name,'') labels,case when e.paused_at is not null then 'paused' else 'active' end status,(e.archived_at is not null) archived,null::date date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.instructions,'')) document,to_tsvector('simple'::regconfig,coalesce(a.name,'') || ' ' || coalesce(p.name,'')) label_document
 from public.routines e left join public.areas a on a.household_id=e.household_id and a.id=e.area_id left join public.pets p on p.household_id=e.household_id and p.id=e.pet_id
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null))
 and (p_types is null or 'routine'=any(p_types))
 union all
select 'occurrence'::text kind,e.id,e.routine_id parent_id,r.title title,
 coalesce(r.instructions,'') || ' ' || coalesce(c.note,'') body,'' labels,e.status status,(r.archived_at is not null or e.status<>'open') archived,e.due_date date,
 to_tsvector('simple'::regconfig,coalesce(r.title,'') || ' ' || coalesce(r.instructions,'') || ' ' || coalesce(c.note,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.routine_occurrences e join public.routines r on r.household_id=e.household_id and r.id=e.routine_id left join public.routine_completions c on c.household_id=e.household_id and c.occurrence_id=e.id
 where e.household_id=tenant and true
 and (p_include_archived or not (r.archived_at is not null or e.status<>'open'))
 and (p_types is null or 'occurrence'=any(p_types))
 union all
select 'meal'::text kind,e.id,null::uuid parent_id,e.title_snapshot title,
 coalesce(e.notes,'') body,'' labels,coalesce(e.slot,'idea') status,(e.removed_at is not null) archived,e.date date,
 to_tsvector('simple'::regconfig,coalesce(e.title_snapshot,'') || ' ' || coalesce(e.notes,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.meal_plan_entries e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.removed_at is not null))
 and (p_types is null or 'meal'=any(p_types))
 union all
select 'meal_library'::text kind,e.id,null::uuid parent_id,e.name title,
 coalesce(e.notes,'') body,'' labels,'active' status,(e.archived_at is not null) archived,null::date date,
 to_tsvector('simple'::regconfig,coalesce(e.name,'') || ' ' || coalesce(e.notes,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.meal_definitions e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null))
 and (p_types is null or 'meal_library'=any(p_types))
 union all
select 'grocery'::text kind,e.id,null::uuid parent_id,e.name title,
 coalesce(e.note,'') || ' ' || coalesce(e.quantity,'') || ' ' || coalesce(e.unit,'') body,coalesce(c.name,'') labels,e.state status,(e.state in('purchased','removed')) archived,null::date date,
 to_tsvector('simple'::regconfig,coalesce(e.name,'') || ' ' || coalesce(e.note,'') || ' ' || coalesce(e.quantity,'') || ' ' || coalesce(e.unit,'')) document,to_tsvector('simple'::regconfig,coalesce(c.name,'')) label_document
 from public.grocery_items e left join public.grocery_categories c on c.household_id=e.household_id and c.id=e.category_id
 where e.household_id=tenant and true
 and (p_include_archived or not (e.state in('purchased','removed')))
 and (p_types is null or 'grocery'=any(p_types))
 union all
select 'money'::text kind,e.id,null::uuid parent_id,e.description title,
 coalesce(e.note,'') body,coalesce(c.name,'') labels,e.type status,(false) archived,e.occurred_on date,
 to_tsvector('simple'::regconfig,coalesce(e.description,'') || ' ' || coalesce(e.note,'')) document,to_tsvector('simple'::regconfig,coalesce(c.name,'')) label_document
 from public.financial_events e left join public.expense_categories c on c.household_id=e.household_id and c.id=e.category_id
 where e.household_id=tenant and true
 and (p_include_archived or not (false))
 and (p_types is null or 'money'=any(p_types))
 union all
select 'project'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.description,'') || ' ' || coalesce(e.destination,'') body,'' labels,e.status status,(e.archived_at is not null or e.status in('complete','cancelled')) archived,e.starts_on date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.description,'') || ' ' || coalesce(e.destination,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.household_projects e
 where e.household_id=tenant and e.kind='project'
 and (p_include_archived or not (e.archived_at is not null or e.status in('complete','cancelled')))
 and (p_types is null or 'project'=any(p_types))
 union all
select 'trip'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.description,'') || ' ' || coalesce(e.destination,'') body,'' labels,e.status status,(e.archived_at is not null or e.status in('complete','cancelled')) archived,e.starts_on date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.description,'') || ' ' || coalesce(e.destination,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.household_projects e
 where e.household_id=tenant and e.kind='trip'
 and (p_include_archived or not (e.archived_at is not null or e.status in('complete','cancelled')))
 and (p_types is null or 'trip'=any(p_types))
 union all
select 'task'::text kind,e.id,e.project_id parent_id,e.title title,
 coalesce(e.notes,'') || ' ' || coalesce(e.section,'') body,p.title labels,case when e.completed_at is null then 'open' else 'completed' end status,(e.archived_at is not null or e.completed_at is not null or p.archived_at is not null or p.status in('complete','cancelled')) archived,e.due_on date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.section,'')) document,to_tsvector('simple'::regconfig,p.title) label_document
 from public.project_tasks e join public.household_projects p on p.household_id=e.household_id and p.id=e.project_id
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null or e.completed_at is not null or p.archived_at is not null or p.status in('complete','cancelled')))
 and (p_types is null or 'task'=any(p_types))
 union all
select 'booking'::text kind,e.id,e.project_id parent_id,e.title title,
 coalesce(e.notes,'') || ' ' || coalesce(e.origin,'') || ' ' || coalesce(e.destination,'') || ' ' || coalesce(e.confirmation,'') body,p.title labels,e.status status,(e.archived_at is not null or e.status='cancelled' or p.archived_at is not null or p.status in('complete','cancelled')) archived,case when exists(select 1 from pg_catalog.pg_timezone_names z where z.name=e.time_zone) then (e.starts_at at time zone e.time_zone)::date end date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.origin,'') || ' ' || coalesce(e.destination,'') || ' ' || coalesce(e.confirmation,'')) document,to_tsvector('simple'::regconfig,p.title) label_document
 from public.trip_bookings e join public.household_projects p on p.household_id=e.household_id and p.id=e.project_id
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null or e.status='cancelled' or p.archived_at is not null or p.status in('complete','cancelled')))
 and (p_types is null or 'booking'=any(p_types) or 'trip'=any(p_types))
 union all
select 'calendar'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.notes,'') || ' ' || coalesce(e.location,'') body,'' labels,case when e.cancelled_at is null then 'planned' else 'cancelled' end status,(e.cancelled_at is not null) archived,case when e.all_day then (e.starts_at at time zone 'UTC')::date when exists(select 1 from pg_catalog.pg_timezone_names z where z.name=e.time_zone) then (e.starts_at at time zone e.time_zone)::date end date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.location,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.calendar_events e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.cancelled_at is not null))
 and (p_types is null or 'calendar'=any(p_types))
 union all
select 'asset'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.notes,'') || ' ' || coalesce(e.category,'') || ' ' || coalesce(e.model,'') || ' ' || coalesce(e.serial_number,'') body,'' labels,'active' status,(e.archived_at is not null) archived,e.warranty_until date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.category,'') || ' ' || coalesce(e.model,'') || ' ' || coalesce(e.serial_number,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.household_assets e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null))
 and (p_types is null or 'asset'=any(p_types))
 union all
select 'contact'::text kind,e.id,null::uuid parent_id,e.name title,
 coalesce(e.notes,'') || ' ' || coalesce(e.company,'') || ' ' || coalesce(e.email,'') || ' ' || coalesce(e.phone,'') body,'' labels,'active' status,(e.archived_at is not null) archived,null::date date,
 to_tsvector('simple'::regconfig,coalesce(e.name,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.company,'') || ' ' || coalesce(e.email,'') || ' ' || coalesce(e.phone,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.household_contacts e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null))
 and (p_types is null or 'contact'=any(p_types))
 union all
select 'commitment'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.notes,'') || ' ' || coalesce(e.provider,'') body,'' labels,e.status status,(e.archived_at is not null or e.status='ended') archived,e.renewal_on date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.notes,'') || ' ' || coalesce(e.provider,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.household_commitments e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null or e.status='ended'))
 and (p_types is null or 'commitment'=any(p_types))
 union all
select 'decision'::text kind,e.id,null::uuid parent_id,e.title title,
 coalesce(e.notes,'') body,'' labels,e.status status,(e.archived_at is not null or e.status='dismissed') archived,null::date date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'') || ' ' || coalesce(e.notes,'')) document,to_tsvector('simple'::regconfig,'') label_document
 from public.household_decisions e
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null or e.status='dismissed'))
 and (p_types is null or 'decision'=any(p_types))
 union all
select 'document'::text kind,e.id,null::uuid parent_id,e.title title,
 '' body,coalesce(p.title,'') || ' ' || coalesce(b.title,'') || ' ' || coalesce(a.title,'') || ' ' || coalesce(c.title,'') labels,'active' status,(e.archived_at is not null) archived,null::date date,
 to_tsvector('simple'::regconfig,coalesce(e.title,'')) document,to_tsvector('simple'::regconfig,coalesce(p.title,'') || ' ' || coalesce(b.title,'') || ' ' || coalesce(a.title,'') || ' ' || coalesce(c.title,'')) label_document
 from public.household_documents e
 left join public.household_projects p on p.household_id=e.household_id and p.id=e.project_id
 left join public.trip_bookings b on b.household_id=e.household_id and b.id=e.booking_id and b.project_id=e.project_id
 left join public.household_assets a on a.household_id=e.household_id and a.id=e.asset_id
 left join public.household_commitments c on c.household_id=e.household_id and c.id=e.commitment_id
 where e.household_id=tenant and true
 and (p_include_archived or not (e.archived_at is not null))
 and (p_types is null or 'document'=any(p_types))
 ), matches as materialized (
 select kind,id,parent_id,title,body,labels,status,archived,date,
 (least(1000000,ts_rank(document,query)*1000+ts_rank(document||label_document,query)*100)+case when lower(title)=lower(normalized) then 10000 else 0 end)::integer score
 from sources where document@@query or (label_document<>''::tsvector and (document||label_document)@@query)
 ), page as materialized (
 select * from matches where p_after_score is null or score<p_after_score or (score=p_after_score and (kind collate "C",id)>(p_after_kind collate "C",p_after_id))
 order by score desc,kind collate "C",id limit p_page_size+1
 ), visible as materialized (select * from page order by score desc,kind collate "C",id limit p_page_size)
 select jsonb_build_object(
 'total_count',(select count(*)::text from matches),
 'results',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'parent_id',parent_id,'title',title,'excerpt',left(ts_headline('simple'::regconfig,regexp_replace(body||' '||labels,'[[:space:]]+',' ','g'),query,'StartSel=«,StopSel=»,MaxWords=32,MinWords=12,MaxFragments=1'),240),'status',status,'archived',archived,'date',date::text,'score',score) order by score desc,kind collate "C",id) from visible),'[]'::jsonb),
 'next_cursor',case when (select count(*) from page)>p_page_size then (select jsonb_build_object('score',score,'kind',kind,'id',id) from visible order by score,kind collate "C" desc,id desc limit 1) else null end
 ) into result;
 return result;
end; $$;
revoke all on function public.search_household(text,text[],boolean,integer,integer,text,uuid) from public,anon;
grant execute on function public.search_household(text,text[],boolean,integer,integer,text,uuid) to authenticated;
