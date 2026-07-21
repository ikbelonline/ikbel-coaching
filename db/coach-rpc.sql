-- ============================================================
--  Ikbel Coaching — coach helper RPCs
--  Let a coach attach a client to themselves without any admin
--  key in the browser.
-- ============================================================

-- Legacy: claim an unclaimed client by their user id.
create or replace function public.add_my_client(client uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    raise exception 'Only a coach can add clients';
  end if;
  update public.profiles
     set coach_id = auth.uid()
   where id = client
     and coach_id is null;   -- only claim if not already owned
end;
$$;
grant execute on function public.add_my_client(uuid) to authenticated;


-- Robust: claim a client BY EMAIL. This makes the "add client" flow
-- idempotent — if the auth account already exists (e.g. a previous
-- attempt created it but failed to link), the coach can still attach it.
-- Returns the client's profile id as text.
create or replace function public.add_my_client_by_email(client_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  target       uuid;
  target_coach uuid;
begin
  if not public.is_coach() then
    raise exception 'Only a coach can add clients';
  end if;

  select id into target
    from auth.users
   where lower(email) = lower(trim(client_email))
   limit 1;

  if target is null then
    raise exception 'ما فماش حساب بهالإيميل. اعمل حساب الحريف الأول.';
  end if;

  select coach_id into target_coach from public.profiles where id = target;

  if target_coach is not null and target_coach <> auth.uid() then
    raise exception 'الحريف هذا موجود عند كوتش آخر.';
  end if;

  update public.profiles
     set coach_id = auth.uid()
   where id = target;

  return target::text;
end;
$$;
grant execute on function public.add_my_client_by_email(text) to authenticated;
