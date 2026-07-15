-- v5: sair do casal + exclusão de conta com carência de 30 minutos

alter table profiles add column deletion_requested_at timestamptz;

-- autoria passa a cascatear: apagar o profile apaga tudo que a pessoa criou
alter table posts drop constraint posts_author_id_fkey;
alter table posts add constraint posts_author_id_fkey
  foreign key (author_id) references profiles (id) on delete cascade;

alter table comments drop constraint comments_author_id_fkey;
alter table comments add constraint comments_author_id_fkey
  foreign key (author_id) references profiles (id) on delete cascade;

alter table reactions drop constraint reactions_author_id_fkey;
alter table reactions add constraint reactions_author_id_fkey
  foreign key (author_id) references profiles (id) on delete cascade;

alter table lists drop constraint lists_created_by_fkey;
alter table lists add constraint lists_created_by_fkey
  foreign key (created_by) references profiles (id) on delete cascade;

alter table list_items drop constraint list_items_added_by_fkey;
alter table list_items add constraint list_items_added_by_fkey
  foreign key (added_by) references profiles (id) on delete cascade;

create function leave_couple() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set couple_id = null where id = auth.uid();
end;
$$;

create function request_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set deletion_requested_at = now() where id = auth.uid();
end;
$$;

create function cancel_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set deletion_requested_at = null where id = auth.uid();
end;
$$;

-- purga: roda a cada 5 min, apaga contas com pedido > 30 min sem relogin
create extension if not exists pg_cron;

create function purge_deleted_accounts() returns void
language plpgsql security definer set search_path = public as $$
declare
  doomed uuid[];
begin
  select array_agg(id) into doomed
  from profiles
  where deletion_requested_at is not null
    and deletion_requested_at < now() - interval '30 minutes';

  if doomed is null then
    return;
  end if;

  delete from storage.objects where owner = any (doomed);
  delete from auth.users where id = any (doomed);
end;
$$;

select cron.schedule('purge-deleted-accounts', '*/5 * * * *', 'select purge_deleted_accounts()');
