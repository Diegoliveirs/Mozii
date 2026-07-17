-- v10: assinaturas + entitlements por ESPAÇO
-- Modelo: freemium. Núcleo de casal grátis; premium (por espaço) desbloqueia
-- grupos (3–8 membros), listas ilimitadas e perks. Cobrança por espaço =
-- "um paga, todos usam": a linha de subscriptions é 1:1 com couples e
-- paid_by registra quem assinou (auditoria + trava de saída).
--
-- Fonte da verdade = Postgres. O client fala direto com o banco (anon key),
-- então todo gate premium é RLS/RPC server-side; o client só decide o que
-- MOSTRAR. Escrita em subscriptions SÓ pela service-role (webhook Stripe).

-- ---------------------------------------------------------------------------
-- 1) Trial por espaço: 7 dias grátis de premium a partir da criação do casal.
--    NOT NULL de propósito: NULL nunca significa "premium eterno".
alter table couples
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '7 days');

-- ---------------------------------------------------------------------------
-- 2) Assinaturas (1:1 com o espaço). price_amount/currency/cancel_at_period_end
--    alimentam a UI de "gerenciar assinatura" (valor + próxima renovação +
--    estado de cancelamento) sem round-trip ao Stripe.
create table if not exists subscriptions (
  couple_id uuid primary key references couples (id) on delete cascade,
  paid_by uuid references auth.users (id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text check (plan in ('weekly', 'monthly', 'lifetime')),
  status text not null default 'incomplete'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid',
                      'incomplete', 'incomplete_expired', 'paused')),
  is_lifetime boolean not null default false,
  current_period_end timestamptz,
  price_amount integer,           -- em centavos, como o Stripe entrega
  currency text,                  -- ex.: 'brl'
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- membros do espaço leem a assinatura do espaço; ninguém escreve via Data API
drop policy if exists "subscriptions: leio a do meu espaço" on subscriptions;
create policy "subscriptions: leio a do meu espaço" on subscriptions
  for select using (couple_id = my_couple_id());

revoke insert, update, delete on subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Entitlement. has_premium é SECURITY DEFINER porque roda dentro de
--    policies de outras tabelas (lists) e em RPCs — precisa enxergar
--    couples/subscriptions sem depender da RLS do chamador.
create or replace function has_premium(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select c.trial_ends_at > now() from couples c where c.id = cid), false)
  or exists (
    select 1 from subscriptions s
    where s.couple_id = cid
      and (
        s.is_lifetime
        or (s.status in ('trialing', 'active')
            and (s.current_period_end is null or s.current_period_end > now()))
      )
  );
$$;

-- atalho do client: tudo que a UI precisa em 1 round-trip
create or replace function get_entitlement() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'is_premium', has_premium(my_couple_id()),
    'trial_ends_at', (select c.trial_ends_at from couples c where c.id = my_couple_id()),
    'plan', s.plan,
    'status', s.status,
    'is_lifetime', coalesce(s.is_lifetime, false),
    'current_period_end', s.current_period_end,
    'price_amount', s.price_amount,
    'currency', s.currency,
    'cancel_at_period_end', coalesce(s.cancel_at_period_end, false)
  )
  from (select 1) as one
  left join subscriptions s on s.couple_id = my_couple_id();
$$;

revoke execute on function has_premium(uuid) from public, anon;
revoke execute on function get_entitlement() from public, anon;
grant execute on function has_premium(uuid) to authenticated;
grant execute on function get_entitlement() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Gate de LISTAS: free = até 3 listas por espaço; premium = ilimitado.
--    A policy FOR ALL de 002_lists.sql vira policies por comando, com o
--    limite checado só no INSERT.
drop policy if exists "lists: tudo do meu casal" on lists;
create policy "lists: ver" on lists
  for select using (couple_id = my_couple_id());
create policy "lists: criar" on lists
  for insert with check (
    couple_id = my_couple_id()
    and (
      has_premium(couple_id)
      or (select count(*) from lists where couple_id = my_couple_id()) < 3
    )
  );
create policy "lists: editar" on lists
  for update using (couple_id = my_couple_id())
  with check (couple_id = my_couple_id());
create policy "lists: excluir" on lists
  for delete using (couple_id = my_couple_id());

-- ---------------------------------------------------------------------------
-- 5) Gate de GRUPO no join_couple: free = 2 membros; premium = até 8.
--    Preserva o rate-limit de invite code de 009_hardening.sql.
create or replace function join_couple(code text) returns couples
language plpgsql security definer set search_path = public as $$
declare
  c couples;
  member_count int;
  recent_failures int;
  max_members int;
begin
  if my_couple_id() is not null then
    raise exception 'Você já está em um espaço';
  end if;
  select count(*) into recent_failures from join_attempts
    where user_id = auth.uid()
      and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 5 then
    raise exception 'Muitas tentativas, aguarde alguns minutos';
  end if;
  select * into c from couples where invite_code = upper(code);
  if c.id is null then
    insert into join_attempts (user_id) values (auth.uid());
    return null; -- client traduz para 'Código inválido'
  end if;
  max_members := case when has_premium(c.id) then 8 else 2 end;
  select count(*) into member_count from profiles where couple_id = c.id;
  if member_count >= max_members then
    if max_members = 2 then
      raise exception 'Este espaço já está completo';
    else
      raise exception 'Este grupo atingiu o limite de membros';
    end if;
  end if;
  update profiles set couple_id = c.id where id = auth.uid();
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Trava do pagante: quem tem assinatura RECORRENTE ativa (e não marcada
--    para cancelar) não sai do espaço nem agenda exclusão de conta — senão o
--    Stripe seguiria cobrando um espaço/conta que já era. Vitalício não trava.
create or replace function payer_has_active_recurring() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions s
    where s.paid_by = auth.uid()
      and s.couple_id = my_couple_id()
      and not s.is_lifetime
      and s.status in ('trialing', 'active')
      and not s.cancel_at_period_end
  );
$$;
revoke execute on function payer_has_active_recurring() from public, anon, authenticated;

create or replace function leave_couple() returns void
language plpgsql security definer set search_path = public as $$
begin
  if payer_has_active_recurring() then
    raise exception 'Cancele sua assinatura antes de sair do espaço';
  end if;
  update profiles set couple_id = null where id = auth.uid();
end;
$$;

create or replace function request_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
begin
  if payer_has_active_recurring() then
    raise exception 'Cancele sua assinatura antes de excluir a conta';
  end if;
  update profiles set deletion_requested_at = now() where id = auth.uid();
end;
$$;
