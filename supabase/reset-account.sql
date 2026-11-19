-- Run once in the Supabase SQL Editor to enable the in-app "Clear my prayer data" action.
-- This is for projects that already ran schema.sql before the reset feature was added.

create or replace function public.reset_my_prayer_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required to reset prayer data.';
  end if;

  delete from public.prayer_completions where user_id = current_user_id;
  delete from public.profiles where id = current_user_id;
end;
$$;

revoke all on function public.reset_my_prayer_data() from public;
grant execute on function public.reset_my_prayer_data() to authenticated;

