-- fix: Supabase bloqueia DELETE direto em storage.objects (trigger protect_delete).
-- A purga apaga só auth.users (cascata leva perfil, posts, comentários, reações,
-- listas). Fotos ficam órfãs no bucket — inacessíveis (RLS), limpar pelo
-- painel Storage quando quiser.

create or replace function purge_deleted_accounts() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users
  where id in (
    select id from profiles
    where deletion_requested_at is not null
      and deletion_requested_at < now() - interval '30 minutes'
  );
end;
$$;
