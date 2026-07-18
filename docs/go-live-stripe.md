# Go-live da monetização (Stripe live mode) — runbook

> Escopo do PR de monetização termina com o **test mode validado no staging**.
> Este runbook é o passo a passo para virar a chave em produção. Nada daqui
> roda automaticamente — executar item a item, na ordem.
>
> Legenda: 👤 = Diego (dashboards) · 🤖 = Claude/CLI (código e terminal)

## Pré-requisitos

- PR `feat/monetizacao-v2` mergeado na main e deploy do app na Vercel ok.
- Conta Stripe ativada para live mode (dados bancários e de negócio preenchidos).
- Projeto Supabase de PRODUÇÃO: `Mozi` (ref `vgdhkpvkywidmqclapaq`).

## 1. Banco de produção

1. 🤖 `supabase link --project-ref vgdhkpvkywidmqclapaq` (produção) — conferir
   duas vezes o ref antes de qualquer comando.
2. 🤖 `supabase db push --dry-run` — deve listar SOMENTE 010/011/012.
   ⚠️ Se quiser reaplicar 001–008, algo está errado — parar e reconciliar com
   `supabase migration repair`.
3. 🤖 `supabase db push` (aplica 010_hardening, 011_subscriptions, 012_grants).
   O backfill dá `trial_ends_at = now() + 7 dias` aos espaços existentes —
   todos ganham 1 semana de premium na virada (intencional: goodwill de launch).

## 2. Stripe live mode

1. 👤 Dashboard Stripe → alternar para **live mode**.
2. 👤 Produto "Mozii Premium" com 3 preços (os valores REAIS de venda):
   - Semanal (recorrente/semana), Mensal (recorrente/mês), Vitalício (avulso).
   - Copiar os 3 `price_...`.
3. 👤 Developers → API keys: copiar `sk_live_...` (NUNCA colar no chat/repo —
   direto no comando do passo 3.1 abaixo ou num arquivo local temporário).
4. 👤 Ativar o Customer Portal em live mode (Settings → Billing → Customer portal).

## 3. Edge Functions de produção

1. 🤖 Com o CLI linkado na produção:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... \
     STRIPE_PRICE_WEEKLY=price_... STRIPE_PRICE_MONTHLY=price_... \
     STRIPE_PRICE_LIFETIME=price_... APP_URL=https://<dominio-de-producao>
   ```
2. 🤖 `supabase functions deploy stripe-checkout stripe-cancel stripe-portal`
   e `supabase functions deploy stripe-webhook --no-verify-jwt`.
3. 👤 Dashboard Stripe (live) → Developers → Webhooks → Add endpoint:
   - URL: `https://vgdhkpvkywidmqclapaq.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copiar o `whsec_...` do endpoint criado.
4. 🤖 `supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...`

## 4. Vercel (produção)

1. 👤 Project Settings → Environment Variables:
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` (é pública por design)
   - conferir `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` apontando para produção.
2. 🤖 Redeploy e conferir os security headers:
   `curl -sI https://<dominio>` deve mostrar a CSP (com js.stripe.com) e HSTS.
   ⚠️ Testar o checkout depois da CSP no ar — se o modal do Stripe não abrir,
   o console mostra qual diretiva bloqueou.

## 5. Auth de produção

1. 👤 Supabase (produção) → Auth → Sign In / Up → **habilitar "Confirm email"**
   (staging fica sem confirmação por causa dos testes; produção confirma).
2. 👤 Conferir Site URL/Redirect URLs (domínio de produção).

## 6. Smoke test com dinheiro de verdade

1. 👤 Assinar o plano SEMANAL (menor valor) com cartão real numa conta própria.
2. Verificar: modal abre → paga → "Premium ativo" sem F5 → perfil mostra plano,
   valor e próxima cobrança → cancelar dentro do app → "Renovação cancelada"
   → Stripe dashboard mostra `cancel_at_period_end = true`.
3. 👤 Reembolsar o pagamento no dashboard (Payments → Refund), se desejado.

## 7. Pós-launch

- 👤 Stripe → Settings → Emails: ativar recibos automáticos.
- 🤖 Apagar a branch `feat/monetizacao` antiga (local e origin).
- Monitorar: Stripe → Webhooks (taxa de falha) e Supabase → Edge Functions → logs.

## Rollback rápido

- Pausar vendas: esconder a rota `/premium` OU desativar os prices no Stripe.
- O acesso de quem já pagou continua funcionando (banco é a fonte da verdade;
  webhook segue sincronizando).
