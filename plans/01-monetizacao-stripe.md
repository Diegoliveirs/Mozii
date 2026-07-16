# Plano 01 — Monetização do Mozii: assinatura (semanal / mensal / vitalício) com free-trial via Stripe

> Gerado por `/make-plan` em 2026-07-16, após descoberta de documentação (Fase 0) com dois subagents:
> um verificou cada fato no codebase (paths + linhas exatas), outro validou as APIs na doc oficial
> Stripe + Supabase Edge Functions. **Todas as referências abaixo foram conferidas — não inventar APIs
> fora da lista de "APIs permitidas".**

## Contexto (mínimo para executar em contexto novo)

Mozii = app privado de casal para acompanhar filmes. Stack: Vite + React 19 + TS + Tailwind v4 +
Supabase (auth/DB/storage/realtime, client fala direto com Postgres via anon key, autorização 100%
por RLS ancorada em `my_couple_id()`) + TMDB. Deploy Vercel. Repository pattern em `src/data/`.
**Hoje não existe backend próprio, Edge Function, nem conceito de plano/assinatura.** Único limite
de produto: 2 membros por casal (`join_couple`, `supabase/migrations/001_profiles_couples.sql:65-68`).

### Decisões já tomadas pelo usuário
- **Freemium**: núcleo de casal grátis; **Grupos (3–8 membros)** é a feature-âncora paga + perks.
- Cobrança **por espaço** (entitlement no `couple_id`), um paga e todos usam.
- Planos: **Semanal + Mensal (recorrentes, trial 7d no Stripe) + Vitalício (one-time)**.
- Trial do app: **7 dias de premium para todo espaço novo** (`couples.trial_ends_at`), independente do Stripe.
- Backend: **Supabase Edge Functions** (Deno) com service-role, mesmo banco.

### Free vs Premium
- **FREE**: até 2 membros; feed/posts/reviews/comentários/reações; TMDB + onde assistir; realtime;
  **até 3 listas**; stats básicas; share card **com marca d'água** "mozii".
- **PREMIUM**: grupos 3–8 membros; listas ilimitadas; share card sem marca d'água + temas;
  stats avançadas; temas do app / avatares extras.
- Limites free (3 listas, watermark) são novos — hoje não existe quota nenhuma (confirmado:
  `lists` tem uma única policy `FOR ALL` sem count, `002_lists.sql:42-43`).

## Definition of Done transversal (TODA fase)

1. **Testes de segurança** (`tests/seguranca/`, Playwright + API REST do Supabase via
   `tests/helpers/api.ts`): RLS negativa, entitlement não contornável com anon key, nenhum segredo
   novo no bundle (`grep VITE_ src/` só pode achar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_TMDB_API_KEY`).
2. **Testes E2E** (Playwright **rodando com `--headed`** — preferência do usuário; o
   `playwright.config.ts` NÃO configura headed, então passar a flag na CLI). Não há script `test`
   no package.json — rodar `npx playwright test --headed` direto.
3. Não avançar de fase com 1 ou 2 vermelhos. Lint = `npm run lint` (oxlint), build = `npm run build`.

---

## Fase 0 — Descoberta de documentação ✅ CONCLUÍDA (resultados consolidados)

### APIs permitidas (validadas na doc oficial — usar SOMENTE estas)

| API | Fonte |
|---|---|
| `stripe.checkout.sessions.create({ mode, line_items: [{price, quantity}], success_url, cancel_url, customer, customer_email, client_reference_id, metadata, subscription_data: {trial_period_days, metadata}, payment_intent_data: {metadata} })` | docs.stripe.com/api/checkout/sessions/create |
| `stripe.billingPortal.sessions.create({ customer, return_url })` → `.url` | docs.stripe.com/api/customer_portal/sessions/create |
| `stripe.webhooks.constructEventAsync(rawBody, sig, secret, undefined, cryptoProvider)` com `const cryptoProvider = Stripe.createSubtleCryptoProvider()` | exemplo oficial supabase/examples/edge-functions/.../stripe-webhooks/index.ts |
| `stripe.customers.create({ email, name, metadata })`; `stripe.customers.list({ email })` | docs.stripe.com/api/customers/{create,list} |
| `import Stripe from 'npm:stripe@^22'` (fetch client é default; NÃO precisa `createFetchHttpClient`) | stripe-node README |
| Edge Function: `npm:@supabase/server@^1` (`withSupabase({ auth }, handler)`, `ctx.supabase` / `ctx.supabaseAdmin`) — padrão oficial 2026; fallback documentado: `Deno.serve` + `createClient` com header `Authorization` + `auth.getUser()` | supabase.com/blog/introducing-supabase-server; docs/guides/functions/auth |
| Env auto-injetadas nas functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; segredos custom: `supabase secrets set NOME=...` + `Deno.env.get('NOME')` (proibido prefixo `SUPABASE_`) | docs/guides/functions/secrets |
| Webhook sem JWT: `[functions.stripe-webhook] verify_jwt = false` no config.toml E/OU `supabase functions deploy stripe-webhook --no-verify-jwt` | docs/guides/cli/config; docs/reference/cli |
| Client: `supabase.functions.invoke('nome', { body })`; erros: `FunctionsHttpError` (ler `await error.context.json()`), `FunctionsRelayError`, `FunctionsFetchError` | docs/reference/javascript/functions-invoke |
| Local: `supabase functions serve` → `http://localhost:54321/functions/v1/<nome>`; `stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook` (imprime `whsec_...`); `stripe trigger <evento>` | docs.stripe.com/cli/{listen,trigger}; docs/guides/functions/quickstart |

### Eventos de webhook a tratar
- `checkout.session.completed` — campos: `mode`, `customer`, `subscription` (id quando mode=subscription),
  `client_reference_id`, `metadata`, `payment_status` (`paid|unpaid|no_payment_required`).
  Vitalício (mode=payment): conceder aqui se `payment_status !== 'unpaid'`; cobrir também
  `checkout.session.async_payment_succeeded` para métodos assíncronos.
- `customer.subscription.created` / `updated` / `deleted` — `status` ∈ `trialing, active, incomplete,
  incomplete_expired, past_due, canceled, unpaid, paused`; `cancel_at_period_end`.
- `invoice.paid` (preferido sobre `invoice.payment_succeeded`) e `invoice.payment_failed`.

### ⚠️ Anti-padrões confirmados (quebram de verdade)
1. `constructEvent` síncrono no Deno → usar `constructEventAsync` **com o 5º argumento
   `cryptoProvider`** (`Stripe.createSubtleCryptoProvider()`).
2. `await req.json()` antes de verificar assinatura → a verificação exige o corpo cru: `await req.text()`.
3. **`subscription.current_period_end` NÃO EXISTE MAIS** (removido na API 2025-03-31.basil):
   ler `subscription.items.data[0].current_period_end`. Idem `current_period_start`.
4. `invoice.payment_intent` como string simples também mudou no basil — não depender dele.
5. `subscription_data` em `mode:'payment'` e `payment_intent_data` em `mode:'subscription'` → rejeitados.
   `customer_creation` só existe em payment/setup (subscription sempre cria Customer).
6. Esquecer `verify_jwt = false` no endpoint do webhook → Stripe recebe 401.
7. Segredo com prefixo `VITE_` (vaza no bundle) ou `SUPABASE_` (CLI rejeita).
8. Imports antigos `esm.sh/stripe?target=deno` ou `deno.land/x` → usar `npm:`.
9. Conceder acesso no `success_url` → só o webhook concede/revoga.
10. `stripe.customers.search` em fluxo read-after-write (consistência eventual ~1min) →
    persistir `stripe_customer_id` no banco e reusar.
11. Fixar `apiVersion` manualmente pode dessincronizar os types → pinar `stripe@^22` e omitir `apiVersion`.

---

## Fase 1 — Autonomia sobre Supabase + Stripe (tooling)

**Estado atual confirmado:** `supabase/config.toml` NÃO existe, `supabase/functions/` NÃO existe —
o CLI nunca foi inicializado; migrations foram aplicadas manualmente pelo dashboard.

### O que fazer
1. `supabase init` na raiz (cria `config.toml`) — **cuidado para não sobrescrever
   `supabase/migrations/` existente** (o init preserva; conferir com `git status` depois).
2. `supabase login` + `supabase link --project-ref <ref>` (ref vem da URL em `.env.local`).
3. Reconciliar histórico de migrations: como 001–009 foram aplicadas à mão, rodar
   `supabase migration repair` / `supabase db push --dry-run` até o CLI reconhecer o estado remoto
   sem tentar reaplicar 001–009.
4. Stripe CLI: `stripe login`; testar `stripe listen --print-secret`.
5. Segredos fora do repo: `.env.local` (já gitignored) + `supabase/functions/.env` (adicionar ao
   `.gitignore`) + `supabase secrets set` para produção. Nunca `VITE_`.

### Verificação
- [ ] `supabase db push --dry-run` conecta e não quer reaplicar 001–009.
- [ ] `supabase functions list` responde.
- [ ] `stripe listen` autentica e imprime `whsec_...`.
- [ ] `git status` não mostra segredo novo versionado.

---

## Fase 2 — Hardening de segurança (BLOQUEADOR para cobrar)

Como o client escreve direto no Postgres, o gating de plano só é confiável se a RLS for íntegra.
Achados confirmados com linha exata:

### O que implementar (nova migration `supabase/migrations/010_hardening.sql`)
1. **`WITH CHECK` nos UPDATEs que não têm** (confirmado ausente):
   - `profiles` — policy `"profiles: atualizo o meu"` em `001_profiles_couples.sql:83-84`;
   - `posts` — policy `"posts: atualizo os meus"` em `005_v2.sql:3-4`;
   - `movies` — policy `"movies: update autenticado"` em `002_lists.sql:39-40`.
   Recriar cada uma com `WITH CHECK` espelhando o `USING`.
2. **Travar `profiles.couple_id` contra escrita direta** (troca de espaço só via RPCs
   `join_couple`/`leave_couple`, que são SECURITY DEFINER): preferir revogação por coluna —
   `revoke update (couple_id) on profiles from authenticated;` (mais simples e robusto que
   comparar no WITH CHECK).
3. **Travar `movies`**: hoje INSERT+UPDATE `with check (true)`/`using (true)` para qualquer
   autenticado (`002_lists.sql:34-40`). Restringir UPDATE (ex.: só permitir upsert de linhas novas,
   ou validar que campos vêm do TMDB via RPC). ⚠️ O teste
   `tests/seguranca/rls-isolamento.spec.ts:158-163` documenta o comportamento aberto como
   intencional ("cache público por design") — **atualizar esse teste junto**.
4. **Invite code**: 6 chars hex maiúsculos = ~24 bits, sem expiração (`001:5`). Adicionar
   `invite_code_expires_at` + regeneração, e/ou rate-limit na RPC `join_couple` (contador de
   tentativas por usuário/hora em tabela própria).
5. **Security headers** no `vercel.json` (hoje só o rewrite de SPA — confirmado): CSP,
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
6. **Verificação de e-mail**: habilitar no dashboard do Supabase (Auth → confirm email). Passo manual.
7. **TMDB key no bundle** (`VITE_TMDB_API_KEY`, `src/api/tmdb.ts:5`): decisão em aberto — proxy via
   Edge Function (agora viável) ou aceitar o risco (key gratuita, rate-limited). Registrar a decisão;
   não bloqueia as fases seguintes.

### Verificação
- [ ] Teste RLS negativo novo em `tests/seguranca/`: usuário do espaço A tenta `PATCH /rest/v1/profiles`
      setando `couple_id` do espaço B → falha; tenta UPDATE em `movies` de outro filme → falha.
      Copiar padrão de auth/chamada de `tests/helpers/api.ts:26-38` e `tests/seguranca/rls-isolamento.spec.ts:48-54`.
- [ ] Suite existente `tests/seguranca/rls-isolamento.spec.ts` verde (ajustada para movies travado).
- [ ] `curl -sI` no deploy mostra os headers novos.

### Anti-padrões
- Não usar `FOR ALL` novo sem `WITH CHECK` explícito.
- Não colocar lógica de rate-limit no client.

---

## Fase 3 — Schema de entitlements + enforcement por RLS

**Arquivo novo:** `supabase/migrations/011_subscriptions.sql` (numeração livre confirmada: última é
`009_realtime.sql`; a 010 vira o hardening da Fase 2).

### O que implementar
1. **Tabela `subscriptions`** (1:1 com `couples`, escrita SÓ pela service-role):
   ```sql
   create table subscriptions (
     couple_id uuid primary key references couples(id) on delete cascade,
     stripe_customer_id text,
     stripe_subscription_id text,
     plan text check (plan in ('weekly','monthly','lifetime')),
     status text,                        -- trialing/active/past_due/canceled/...
     current_period_end timestamptz,     -- vem de subscription.items.data[0].current_period_end (basil!)
     is_lifetime boolean not null default false,
     updated_at timestamptz not null default now()
   );
   alter table subscriptions enable row level security;
   create policy "subscriptions: leio a do meu espaço" on subscriptions
     for select using (couple_id = my_couple_id());
   -- SEM policy de INSERT/UPDATE/DELETE: só a service-role (bypassa RLS) escreve.
   ```
2. **`couples.trial_ends_at timestamptz default now() + interval '7 days'`** — trial gerido pelo app.
   Backfill para espaços existentes (decidir: dar 7 dias a partir da migration).
3. **`has_premium(cid uuid) returns boolean`** — `security definer, stable`, `set search_path = public`
   (copiar o estilo de `my_couple_id()` em `001:33-36`): true se `couples.trial_ends_at > now()`
   OU existe subscription do espaço com `is_lifetime` OU (`status in ('trialing','active')` e
   `current_period_end > now()`).
4. **Quota de listas free**: a policy atual de `lists` é uma única `FOR ALL` (`002_lists.sql:42-43`) —
   **dividir**: manter SELECT/UPDATE/DELETE como estão e criar INSERT separado:
   `WITH CHECK (couple_id = my_couple_id() AND (has_premium(couple_id) OR (select count(*) from lists where couple_id = my_couple_id()) < 3))`.
5. **`join_couple` por entitlement**: substituir o hard-check de `001:65-68`
   (`if member_count >= 2 then raise exception`) por limite dinâmico: `2` se `not has_premium(c.id)`,
   senão `8`. Manter a mensagem de erro existente para o caso free (a UI já a conhece:
   `t.pairing.full` = 'Este espaço já está completo').
6. **Realtime**: `alter publication supabase_realtime add table subscriptions;` +
   `alter table subscriptions replica identity full;` (padrão de `009_realtime.sql:3-7`).

### Verificação
- [ ] Teste API (padrão `tests/helpers/api.ts`): com trial expirado (UPDATE via service-role local no
      teste ou fixture SQL), inserir a 4ª lista → 403/42501; com `trial_ends_at` futuro → passa.
- [ ] `join_couple` recusa 3º membro sem premium; aceita com subscription `active` semeada.
- [ ] SELECT em `subscriptions` de outro espaço → 0 linhas; INSERT/UPDATE com anon key → falha.

### Anti-padrões
- `has_premium` sem `security definer` (RLS de subscriptions esconderia a linha e quebraria o gate).
- Esquecer o backfill de `trial_ends_at` (espaços antigos ficariam premium eternos se NULL for
  tratado como "sem trial" invertido — definir semântica explícita: NULL = sem trial).

---

## Fase 4 — Edge Functions do Stripe (backend)

**Estrutura nova** `supabase/functions/` (não existe — confirmado). Copiar o exemplo oficial do
webhook (github.com/supabase/supabase → examples/edge-functions/.../stripe-webhooks/index.ts),
que usa `npm:stripe@^22` + `npm:@supabase/server@^1`:

### O que implementar
1. **`_shared/stripe.ts`** — `import Stripe from 'npm:stripe@^22'`;
   `new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)` (sem `apiVersion`, sem `httpClient`).
2. **`stripe-checkout/index.ts`** — `withSupabase({ auth: 'user' }, handler)`: pega o usuário de
   `ctx` (client RLS-scoped), resolve `couple_id` do profile, cria/reusa Customer
   (`stripe_customer_id` salvo em `subscriptions` — criar linha stub se não existir, via
   `ctx.supabaseAdmin`), monta a session:
   - weekly/monthly: `mode:'subscription'`, `line_items:[{price: Deno.env.get('STRIPE_PRICE_WEEKLY'|'..MONTHLY'), quantity:1}]`,
     `subscription_data: { trial_period_days: 7, metadata: { couple_id } }`;
   - lifetime: `mode:'payment'`, price `STRIPE_PRICE_LIFETIME`, `metadata: { couple_id }` no nível da session;
   - sempre: `customer`, `client_reference_id: couple_id`, `success_url`/`cancel_url` de volta pro app.
   Retorna `{ url: session.url }`.
3. **`stripe-webhook/index.ts`** — `withSupabase({ auth: 'none' }, ...)` + `verify_jwt = false` no
   `config.toml`. Corpo cru `await req.text()`, `constructEventAsync(..., cryptoProvider)`.
   Handler idempotente que faz UPSERT em `subscriptions` por `couple_id`
   (de `metadata.couple_id` / `client_reference_id`, com fallback por `stripe_customer_id`):
   - `checkout.session.completed`: se `mode==='payment'` e `payment_status!=='unpaid'` →
     `is_lifetime=true, plan='lifetime', status='active'`; se `mode==='subscription'` → gravar
     `stripe_subscription_id` (o estado detalhado vem pelos eventos de subscription);
   - `customer.subscription.created|updated|deleted`: gravar `status`, `plan` (mapear pelo price id),
     e **`current_period_end` de `subscription.items.data[0].current_period_end`** (basil!);
   - `invoice.paid` / `invoice.payment_failed`: refresh de `status`.
   **Único ponto que concede/revoga acesso.** Sempre responder 200 rápido; 400 só para assinatura inválida.
4. **`stripe-portal/index.ts`** — `withSupabase({ auth: 'user' })`: resolve `stripe_customer_id` do
   espaço, `stripe.billingPortal.sessions.create({ customer, return_url })`, retorna `{ url }`.
5. **Stripe Dashboard (test mode)**: Product "Mozii Premium" com 3 Prices (week/month recurring +
   lifetime one-time); ativar o Customer Portal (test); registrar depois o endpoint de produção.
6. **Segredos**: `supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SIGNING_SECRET=whsec_... STRIPE_PRICE_WEEKLY=price_... STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_LIFETIME=price_...`
   (local: `supabase/functions/.env`, gitignored).

### Verificação
- [ ] `supabase functions serve` + `stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook`
      + `stripe trigger checkout.session.completed` → upsert aparece em `subscriptions`.
      (⚠️ `stripe trigger` cria fixture genérica sem `couple_id` — validar o parse/fallback; o fluxo
      realista fica para o E2E da Fase 6 com cartão `4242 4242 4242 4242`.)
- [ ] Request ao webhook com assinatura inválida → 400; replay do mesmo evento → estado final idêntico
      (idempotência).
- [ ] `stripe-checkout` sem JWT → 401; com JWT de usuário sem couple → erro tratado.

### Anti-padrões
- Toda a lista da Fase 0 (constructEvent síncrono, req.json(), current_period_end no objeto raiz,
  conceder acesso no success_url, segredos VITE_/SUPABASE_).
- Não usar `stripe.customers.search` para achar o customer — persistir e reusar o id.

---

## Fase 5 — Camada de dados + hooks (client)

Seguir o repository pattern existente (tudo confirmado):

### O que implementar
1. **Interface `BillingRepository`** em `src/data/repositories.ts` (copiar o formato de
   `ListRepository`, `repositories.ts:34-44`): `getSubscription(coupleId)`, `startCheckout(plan)`,
   `openPortal()`. Adicionar ao agregado `Repositories` (`repositories.ts:73-79`).
2. **`src/data/supabase/SupabaseBillingRepository.ts`** — classe no padrão de
   `SupabaseListRepository.ts:25` (client compartilhado de `./client`):
   - `startCheckout`/`openPortal`: `supabase.functions.invoke('stripe-checkout'|'stripe-portal', { body })`,
     tratar `FunctionsHttpError` (`await error.context.json()`), retornar a `url` (o caller faz
     `window.location.href = url`);
   - `getSubscription`: `select` em `subscriptions` (RLS já escopa).
   Registrar no factory `createSupabaseRepositories()` (`src/data/supabase/index.ts:8-16`).
3. **`src/hooks/useSubscription.ts`** — copiar o padrão de `useLists()` (`src/hooks/useLists.ts:6-15`):
   `useQuery({ queryKey: ['subscription', coupleId], ... , enabled: !!coupleId })`.
4. **`src/hooks/useEntitlements.ts`** — deriva `{ isPremium, isTrialing, trialEndsAt, plan }` de
   subscription + `couples.trial_ends_at` (expor `trial_ends_at` via o repositório de couple).
   **Espelho de `has_premium` do banco** — o banco decide, o client só mostra.
5. **Realtime sem F5**: adicionar `subscriptions: ['subscription']` ao `INVALIDATE_BY_TABLE`
   (`src/hooks/useRealtimeCouple.ts:8-14`) **e** `{ table: 'subscriptions', filter: 'couple_id=eq.${coupleId}' }`
   à lista de tabelas em `SupabaseFeedRepository.subscribeToCouple`
   (`src/data/supabase/SupabaseFeedRepository.ts:195-201`). (A publication já foi na Fase 3.)

### Verificação
- [ ] `npm run lint` + `npm run build` verdes.
- [ ] Teste E2E provisório: com subscription semeada via API, `useEntitlements` reflete premium;
      UPDATE na linha via service-role local → UI atualiza sem reload (realtime).

### Anti-padrões
- Não instalar Stripe.js / publishable key — Checkout hosted só precisa do redirect para `session.url`.
- Não decidir entitlement no client sem o espelho do banco (banco é fonte da verdade).

---

## Fase 6 — UI de premium / paywall

### O que implementar (padrões a copiar confirmados)
1. **Rota `/premium`** → `src/pages/UpgradePage.tsx`. Declarar rota no padrão de `src/App.tsx:63`
   (`<Route path="/listas" element={<ListsPage />} />`), dentro do nesting
   `RequireAuth → RequireCouple → AppShell` (`App.tsx:51-70`). Layout mobile `max-w-md` como
   `SettingsPage.tsx`/`PairingPage.tsx`. Pricing dos 3 planos + CTA → `startCheckout(plan)`.
2. **`src/components/premium/Paywall.tsx`** — bottom-sheet reutilizável: copiar a estrutura de
   `AddToListSheet.tsx:31-37` (backdrop `bg-black/60` + `sheet-in` + `rounded-t-3xl bg-card` +
   drag-handle). Recebe `feature` para mensagem contextual.
3. **`TrialBanner.tsx`** — faixa "Seu trial acaba em X dias" no `AppShell.tsx` (que já chama
   `useRealtimeCouple()` na linha 7 — mesmo nível).
4. **`PremiumBadge.tsx`** + botão "Gerenciar assinatura" (→ `openPortal()`) no `SettingsPage.tsx`.
5. **Gates de UI** (o banco já bloqueia; a UI evita o erro feio):
   - 4ª lista: `ListsPage.tsx:13-18` (`handleCreate`) e `AddToListSheet.tsx:24-29` (criação inline);
   - 3º membro: `PairingPage.tsx:34-45` (exibição do invite) — mostrar upsell se free e 2 membros;
   - watermark: **dois pontos de render** — `ShareCard.tsx:149-151` (preview DOM, footer
     `{t.share.reviewedTogether} · mozii`) e `src/lib/renderShareCard.ts` (export canvas), com
     constantes em `src/lib/shareCardLayout.ts`. Free = watermark maior/fixa; premium = discreta/removível;
   - stats avançadas: `SettingsPage.tsx`.
6. **i18n**: novo namespace no objeto `t` de `src/lib/i18n.ts` (padrão flat confirmado, pt-BR), ex.
   `premium: { title, weekly, monthly, lifetime, trialBanner, managePlan, paywallLists, paywallMembers, ... }`.

### Verificação (Playwright `--headed`)
- [ ] Fluxo completo: clicar assinar → Checkout test do Stripe (cartão `4242 4242 4242 4242`) →
      webhook grava → voltar ao app → premium liberado **sem F5**.
- [ ] Free: 4ª lista abre o Paywall (e não o erro cru do Postgres); share card mostra watermark.
- [ ] "Gerenciar assinatura" abre o Billing Portal.
- [ ] `npm run lint`, `npm run build`.

---

## Fase 7 — Feature "Grupos" (3–8 membros)

Banco já pronto (Fase 3). Generalizar o que assume 2 membros:

### O que implementar
1. **UI N membros**: `ProfileAvatar` (cor por índice), stats por membro no `SettingsPage`, header.
2. **Cópia**: "casal"/"a dois" → "espaço"/"grupo" onde couber, mantendo tom romântico quando
   membros = 2. Centralizado em `src/lib/i18n.ts` (inclusive `tagline: 'filmes a dois'` e
   `t.share.reviewedTogether` — tornar dinâmico por contagem de membros).
3. **`PairingPage`**: convidar mais gente (reusa invite code) quando premium; free com 2 membros vê
   o upsell de grupo (gancho de conversão principal).
4. Revisar `my_couple_id()` — segue válido (1 profile → 1 espaço), nenhuma mudança.

### Verificação (Playwright `--headed` + API)
- [ ] Espaço premium: 3º membro entra via invite code; feed/reações/stats funcionam com 3 autores.
- [ ] Espaço free: 3º membro é recusado (mensagem `t.pairing.full`) e a UI oferece premium.
- [ ] Testes de segurança: 3º membro de espaço premium não enxerga dados de outros espaços
      (rodar `tests/seguranca/rls-isolamento.spec.ts` adaptada).

---

## Fase 8 — Divulgação / marketing (não-código, planejamento)

- Posicionamento: "o app do casal (e do grupo) pra decidir o que assistir juntos".
- Loop viral: share card do Stories com watermark "mozii" + QR/handle no free = aquisição orgânica;
  premium remove.
- Canais: Instagram/TikTok (Reels "review a dois"), comunidades de casais, Product Hunt, ASO quando
  empacotar como TWA.
- Conversão: trial 7d + paywall contextual ("quer adicionar um 3º? vira grupo com premium");
  vitalício como âncora de preço.
- Futuro: referral (convidar outro espaço → dias de premium).

---

## Fase 9 — Verificação end-to-end consolidada

1. [ ] Segurança: `tests/seguranca/` completa verde; nenhum UPDATE/INSERT direto com anon key
       contorna entitlement; `grep -r "sk_test\|sk_live\|whsec" src/ dist/` vazio.
2. [ ] Banco: `has_premium` correto nos 3 caminhos (trial / lifetime / recorrente com
       `current_period_end` futuro e vencido); quotas de lista e membro.
3. [ ] Stripe: `stripe listen` + evento real de Checkout test gravam a subscription; webhook valida
       assinatura, é idempotente e ignora eventos desconhecidos com 200.
4. [ ] Client: Playwright `--headed` — assinar, upgrade sem F5, paywall para free, portal abre,
       cancelamento no portal → volta a free quando o webhook `customer.subscription.deleted` chega.
5. [ ] Grupos: premium adiciona 3º; free bloqueado com paywall.
6. [ ] `npm run lint`, `npm run build`, `npm run audit` (nível high).
7. Tudo em **test mode** até aqui; só então trocar chaves live via `supabase secrets set` e registrar
   o endpoint de webhook de produção no dashboard do Stripe.

---

## Arquivos-chave (paths confirmados no repo)

**Novos:** `supabase/migrations/010_hardening.sql`, `011_subscriptions.sql`;
`supabase/config.toml` (via `supabase init`); `supabase/functions/{_shared,stripe-checkout,stripe-webhook,stripe-portal}/`;
`src/data/supabase/SupabaseBillingRepository.ts`; `src/hooks/{useSubscription,useEntitlements}.ts`;
`src/pages/UpgradePage.tsx`; `src/components/premium/{Paywall,TrialBanner,PremiumBadge}.tsx`;
novos specs em `tests/seguranca/`.

**Modificados:** `src/data/repositories.ts` (+`BillingRepository`, `Repositories`);
`src/data/supabase/index.ts` (factory); `src/hooks/useRealtimeCouple.ts` (`INVALIDATE_BY_TABLE`);
`src/data/supabase/SupabaseFeedRepository.ts:195-201` (tabelas realtime); `src/App.tsx` (rota);
`src/components/layout/AppShell.tsx` (TrialBanner); `src/pages/{ListsPage,PairingPage,SettingsPage}.tsx`;
`src/components/share/ShareCard.tsx` + `src/lib/renderShareCard.ts` + `src/lib/shareCardLayout.ts`
(watermark); `src/components/movies/AddToListSheet.tsx` (gate de lista); `src/lib/i18n.ts`;
`vercel.json` (headers); `tests/seguranca/rls-isolamento.spec.ts` (movies travado);
`.gitignore` (`supabase/functions/.env`).
