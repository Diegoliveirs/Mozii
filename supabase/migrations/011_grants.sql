-- v11: GRANTs explícitos da Data API (compat com o default novo do Supabase)
-- As migrations antigas dependiam de grants IMPLÍCITOS ao role `authenticated`
-- (comportamento legado, ainda ativo na produção atual). Projetos criados hoje
-- podem revogar privilégios em entidades novas do schema public — estes GRANTs
-- tornam o contrato explícito e são idempotentes (inócuos onde já existem).
--
-- RLS continua sendo o gate de LINHAS; isto concede só o privilégio de tabela.
-- Nada aqui contradiz os REVOKEs cirúrgicos de 009/010 (movies/profiles/
-- subscriptions): não concedemos escrita direta nelas.

grant usage on schema public to anon, authenticated;

-- Tabelas de leitura (escrita via RPC/service-role)
grant select on couples to authenticated;
grant select on movies to authenticated;
grant select on subscriptions to authenticated;
-- profiles: SELECT aqui; o UPDATE(display_name, avatar_url) já vem de 009
grant select on profiles to authenticated;

-- Tabelas CRUD do casal (escopadas por RLS)
grant select, insert, update, delete on lists to authenticated;
grant select, insert, update, delete on list_items to authenticated;
grant select, insert, update, delete on posts to authenticated;
grant select, insert, delete on comments to authenticated;
grant select, insert, delete on reactions to authenticated;

-- RPCs chamadas pelo client (as demais já têm execute em 009/010)
grant execute on function create_couple() to authenticated;
grant execute on function join_couple(text) to authenticated;
grant execute on function leave_couple() to authenticated;
grant execute on function request_account_deletion() to authenticated;
grant execute on function cancel_account_deletion() to authenticated;
