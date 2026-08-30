-- Members edit routine optional fields (instructions, pet_id) through the
-- column-scoped UPDATE grant on public.routines. Every UPDATE re-evaluates the
-- table's schedule CHECK constraint, and CHECK expressions run as the invoking
-- role, so authenticated needs EXECUTE on the validator for those granted
-- direct updates to succeed at all.
grant execute on function private.is_valid_routine_schedule(text, jsonb)
to authenticated;
