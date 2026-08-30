-- Add the biweekly calendar schedule rule: every two weeks on one ISO weekday.
-- The rule anchors on the first matching weekday, and each closure advances to
-- the matching weekday in the week after next, so an on-weekday closure yields
-- exactly fourteen days. Mirrors src/domain/routines/schedule.ts.

create or replace function private.is_valid_routine_schedule(
  p_schedule_kind text,
  p_schedule_rule jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule_kind text;
  item jsonb;
  value_integer integer;
  seen_weekdays integer[] := '{}';
  value_date date;
begin
  if p_schedule_rule is null or jsonb_typeof(p_schedule_rule) <> 'object' then
    return false;
  end if;

  rule_kind := p_schedule_rule ->> 'kind';
  case rule_kind
    when 'one_off' then
      if p_schedule_kind <> 'one_off'
        or p_schedule_rule - array['kind', 'date'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'date') <> 'string'
      then
        return false;
      end if;
      value_date := (p_schedule_rule ->> 'date')::date;
      return to_char(value_date, 'YYYY-MM-DD') = p_schedule_rule ->> 'date';
    when 'daily' then
      return p_schedule_kind = 'calendar'
        and p_schedule_rule = '{"kind":"daily"}'::jsonb;
    when 'weekdays' then
      if p_schedule_kind <> 'calendar'
        or p_schedule_rule - array['kind', 'days'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'days') <> 'array'
        or jsonb_array_length(p_schedule_rule -> 'days') = 0
      then
        return false;
      end if;

      for item in
        select element
        from jsonb_array_elements(p_schedule_rule -> 'days') as days(element)
      loop
        if jsonb_typeof(item) <> 'number'
          or (item #>> '{}') !~ '^[0-9]+$'
        then
          return false;
        end if;
        value_integer := (item #>> '{}')::integer;
        if value_integer not between 1 and 7
          or value_integer = any(seen_weekdays)
        then
          return false;
        end if;
        seen_weekdays := array_append(seen_weekdays, value_integer);
      end loop;
      return true;
    when 'weekly', 'biweekly' then
      if p_schedule_kind <> 'calendar'
        or p_schedule_rule - array['kind', 'weekday'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'weekday') <> 'number'
        or (p_schedule_rule ->> 'weekday') !~ '^[0-9]+$'
      then
        return false;
      end if;
      return (p_schedule_rule ->> 'weekday')::integer between 1 and 7;
    when 'monthly' then
      if p_schedule_kind <> 'calendar'
        or p_schedule_rule - array['kind', 'dayOfMonth'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'dayOfMonth') <> 'number'
        or (p_schedule_rule ->> 'dayOfMonth') !~ '^[0-9]+$'
      then
        return false;
      end if;
      return (p_schedule_rule ->> 'dayOfMonth')::integer between 1 and 31;
    when 'after_completion' then
      if p_schedule_kind <> 'after_completion'
        or p_schedule_rule - array['kind', 'every', 'unit'] <> '{}'::jsonb
        or jsonb_typeof(p_schedule_rule -> 'every') <> 'number'
        or (p_schedule_rule ->> 'every') !~ '^[0-9]+$'
        or p_schedule_rule ->> 'unit' not in ('days', 'weeks')
      then
        return false;
      end if;
      return (p_schedule_rule ->> 'every')::integer >= 1;
    else
      return false;
  end case;
exception
  when others then
    return false;
end;
$$;

create or replace function private.first_routine_due_date(
  p_schedule_rule jsonb,
  p_from_inclusive date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule_kind text := p_schedule_rule ->> 'kind';
  candidate date;
  requested integer;
  month_start date;
  last_day integer;
  step integer;
begin
  case rule_kind
    when 'one_off' then
      return (p_schedule_rule ->> 'date')::date;
    when 'daily' then
      return p_from_inclusive;
    when 'weekdays' then
      candidate := p_from_inclusive;
      for step in 0..7 loop
        if extract(isodow from candidate)::integer in (
          select value::integer
          from jsonb_array_elements_text(p_schedule_rule -> 'days') as day(value)
        ) then
          return candidate;
        end if;
        candidate := candidate + 1;
      end loop;
      raise exception 'failed to find a selected weekday';
    when 'weekly', 'biweekly' then
      requested := (p_schedule_rule ->> 'weekday')::integer;
      return p_from_inclusive
        + ((requested - extract(isodow from p_from_inclusive)::integer + 7) % 7);
    when 'monthly' then
      requested := (p_schedule_rule ->> 'dayOfMonth')::integer;
      month_start := date_trunc('month', p_from_inclusive)::date;
      last_day := extract(day from month_start + interval '1 month - 1 day')::integer;
      candidate := make_date(
        extract(year from month_start)::integer,
        extract(month from month_start)::integer,
        least(requested, last_day)
      );
      if candidate >= p_from_inclusive then
        return candidate;
      end if;
      month_start := (month_start + interval '1 month')::date;
      last_day := extract(day from month_start + interval '1 month - 1 day')::integer;
      return make_date(
        extract(year from month_start)::integer,
        extract(month from month_start)::integer,
        least(requested, last_day)
      );
    when 'after_completion' then
      requested := (p_schedule_rule ->> 'every')::integer;
      if p_schedule_rule ->> 'unit' = 'days' then
        return p_from_inclusive + requested;
      end if;
      if p_schedule_rule ->> 'unit' = 'weeks' then
        return p_from_inclusive + (requested * 7);
      end if;
      raise exception 'unknown after_completion unit %', p_schedule_rule ->> 'unit';
    else
      raise exception 'unknown schedule rule kind %', rule_kind;
  end case;
end;
$$;

create or replace function private.next_routine_due_date(
  p_schedule_rule jsonb,
  p_closed_due_date date,
  p_completed_on date default null
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule_kind text := p_schedule_rule ->> 'kind';
  every_n integer;
  anchor_date date;
begin
  case rule_kind
    when 'one_off' then
      return null;
    when 'daily' then
      return p_closed_due_date + 1;
    when 'weekdays', 'weekly', 'monthly' then
      return private.first_routine_due_date(p_schedule_rule, p_closed_due_date + 1);
    when 'biweekly' then
      return private.first_routine_due_date(p_schedule_rule, p_closed_due_date + 8);
    when 'after_completion' then
      every_n := (p_schedule_rule ->> 'every')::integer;
      anchor_date := coalesce(p_completed_on, p_closed_due_date);
      if p_schedule_rule ->> 'unit' = 'days' then
        return anchor_date + every_n;
      end if;
      if p_schedule_rule ->> 'unit' = 'weeks' then
        return anchor_date + (every_n * 7);
      end if;
      raise exception 'unknown after_completion unit %', p_schedule_rule ->> 'unit';
    else
      raise exception 'unknown schedule rule kind %', rule_kind;
  end case;
end;
$$;
