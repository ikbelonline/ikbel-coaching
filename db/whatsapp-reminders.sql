-- ============================================================
--  Ikbel Coaching — AUTOMATED WhatsApp reminders  (Phase 3)
--  Sends a reminder to every client who hasn't logged today,
--  using the Meta WhatsApp Cloud API, on a daily schedule.
--
--  PREREQUISITES (you do these once in Phase 2):
--   1. Meta WhatsApp Cloud API set up → you get:
--        - a permanent ACCESS TOKEN
--        - your PHONE NUMBER ID
--   2. A Meta-APPROVED message template (utility category), e.g.
--        name: reminder_log   language: ar
--        body: "أهلا {{1}}، تذكير باش تسجّل ماكلتك و وزنك اليوم في التطبيق 💪"
--   3. In Supabase → Database → Extensions, enable: pg_cron, pg_net
--   4. Store the token in Supabase Vault (Project → Vault → New secret):
--        name = wa_token   value = <your access token>
--
--  Then FILL the two placeholders below and run this file once.
-- ============================================================

-- >>> FILL THESE <<<
--   PHONE_NUMBER_ID : from Meta (WhatsApp → API setup)
--   TEMPLATE_NAME   : the approved template name (default reminder_log)

create or replace function public.send_whatsapp_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  r          record;
  token      text;
  phone_id   text := 'PHONE_NUMBER_ID';   -- <<< FILL
  tmpl       text := 'reminder_log';       -- <<< FILL (approved template)
  sent       integer := 0;
begin
  select decrypted_secret into token
    from vault.decrypted_secrets where name = 'wa_token';
  if token is null then
    raise exception 'Vault secret wa_token not found';
  end if;

  for r in
    select p.id, p.full_name, p.phone
      from public.profiles p
     where p.role = 'client'
       and p.active
       and p.phone is not null
       and length(regexp_replace(p.phone, '\D', '', 'g')) >= 8
       and not exists (               -- skip clients who already logged today
         select 1 from public.adherence a
          where a.client_id = p.id and a.date = current_date
       )
  loop
    perform net.http_post(
      url     := 'https://graph.facebook.com/v21.0/' || phone_id || '/messages',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || token,
                   'Content-Type',  'application/json'),
      body    := jsonb_build_object(
        'messaging_product', 'whatsapp',
        -- normalise to E.164 digits; 8-digit numbers get Tunisia's 216 prefix
        'to', case when length(regexp_replace(r.phone,'\D','','g')) = 8
                   then '216' || regexp_replace(r.phone,'\D','','g')
                   else regexp_replace(r.phone,'\D','','g') end,
        'type', 'template',
        'template', jsonb_build_object(
          'name', tmpl,
          'language', jsonb_build_object('code', 'ar'),
          'components', jsonb_build_array(
            jsonb_build_object('type','body','parameters', jsonb_build_array(
              jsonb_build_object('type','text',
                'text', coalesce(nullif(split_part(r.full_name,' ',1),''), 'صاحبي'))
            ))
          )
        )
      )
    );
    sent := sent + 1;
  end loop;

  return sent;   -- how many reminders were queued
end;
$$;

grant execute on function public.send_whatsapp_reminders() to postgres;

-- --- schedule: every day at 18:00 UTC (= 19:00 Tunis winter / 20:00 summer).
-- Adjust the cron expression to the hour you want.
select cron.schedule(
  'wa-daily-reminders',
  '0 18 * * *',
  $$ select public.send_whatsapp_reminders(); $$
);

-- To test immediately without waiting for the schedule:
--   select public.send_whatsapp_reminders();
-- To change the time later:  select cron.alter_job( job_id, schedule => '0 17 * * *' );
-- To stop:                    select cron.unschedule('wa-daily-reminders');
