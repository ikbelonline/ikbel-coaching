-- ============================================================
--  Ikbel Coaching — coach helper RPC
--  Lets a coach attach a newly-created (unclaimed) client to
--  themselves, without needing any admin key in the browser.
-- ============================================================
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
