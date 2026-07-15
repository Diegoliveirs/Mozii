-- Fase 1: casais, perfis, pareamento

create table couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  couple_id uuid references couples (id),
  created_at timestamptz not null default now()
);

-- perfil criado automaticamente no signup (display_name vem do metadata)
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- helper de RLS: security definer evita recursão na policy de profiles
create function my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from profiles where id = auth.uid()
$$;

create function create_couple() returns couples
language plpgsql security definer set search_path = public as $$
declare
  c couples;
begin
  if my_couple_id() is not null then
    raise exception 'Você já está em um espaço';
  end if;
  insert into couples (created_by) values (auth.uid()) returning * into c;
  update profiles set couple_id = c.id where id = auth.uid();
  return c;
end;
$$;

create function join_couple(code text) returns couples
language plpgsql security definer set search_path = public as $$
declare
  c couples;
  member_count int;
begin
  if my_couple_id() is not null then
    raise exception 'Você já está em um espaço';
  end if;
  select * into c from couples where invite_code = upper(code);
  if c.id is null then
    raise exception 'Código inválido';
  end if;
  select count(*) into member_count from profiles where couple_id = c.id;
  if member_count >= 2 then
    raise exception 'Este espaço já está completo';
  end if;
  update profiles set couple_id = c.id where id = auth.uid();
  return c;
end;
$$;

alter table couples enable row level security;
alter table profiles enable row level security;

create policy "couples: membros leem" on couples
  for select using (id = my_couple_id());

create policy "profiles: eu ou meu par" on profiles
  for select using (id = auth.uid() or (couple_id is not null and couple_id = my_couple_id()));

create policy "profiles: atualizo o meu" on profiles
  for update using (id = auth.uid());
