-- Metadata-only usage for the authenticated household. No object bytes or global totals leave SQL.
create function public.household_attachment_usage()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_household uuid; v_usage text;
begin
  if auth.uid() is null then
    raise exception 'Household membership required' using errcode='42501';
  end if;
  select household_id into v_household from public.household_members where user_id=auth.uid();
  if v_household is null then
    raise exception 'Household membership required' using errcode='42501';
  end if;
  -- Missing, fractional, negative or malformed sizes make the total unknown.
  -- numeric SUM and a text result preserve integer precision beyond bigint/JS Number.
  select case when count(*) filter (where size_text is null or size_text !~ '^(0|[1-9][0-9]{0,29})$') > 0
    then null
    else coalesce(sum(case when size_text ~ '^(0|[1-9][0-9]{0,29})$' then size_text::numeric end),0)::text end
  into v_usage
  from (
    select metadata->>'size' as size_text from storage.objects
    where bucket_id='household-files' and lower(split_part(name,'/',1))=v_household::text
      and strpos(name,'/')>0
  ) as objects;
  return v_usage;
end;
$$;
revoke all on function public.household_attachment_usage() from public, anon;
grant execute on function public.household_attachment_usage() to authenticated;
