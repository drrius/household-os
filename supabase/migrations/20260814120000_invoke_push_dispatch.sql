create or replace function private.invoke_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispatch_url text;
  service_key text;
  request_id bigint;
begin
  select secrets.decrypted_secret
  into dispatch_url
  from vault.decrypted_secrets as secrets
  where secrets.name = 'push_dispatch_url';

  select secrets.decrypted_secret
  into service_key
  from vault.decrypted_secrets as secrets
  where secrets.name = 'push_dispatch_service_role_key';

  if dispatch_url is null or btrim(dispatch_url) = '' then
    return null;
  end if;

  if service_key is null or btrim(service_key) = '' then
    return null;
  end if;

  select net.http_post(
    url := dispatch_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ),
    timeout_milliseconds := 15000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_push_dispatch() from public, anon, authenticated;
grant execute on function private.invoke_push_dispatch() to service_role;

do $cron$
begin
  perform cron.schedule(
    'household-os-invoke-push-dispatch',
    '* * * * *',
    $$select private.invoke_push_dispatch();$$
  );
exception when others then
  null;
end;
$cron$;
