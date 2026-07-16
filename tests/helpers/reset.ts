import { api } from './api'

/**
 * Garante que o usuário de teste existe e está zerado:
 * sem exclusão pendente, nome restaurado, conteúdo e listas do casal apagados,
 * fotos do casal removidas do bucket, fora de qualquer casal.
 */
export async function resetTestUser(email: string, password: string, displayName: string) {
  await api('/auth/v1/signup', null, {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  })

  const loginRes = await api('/auth/v1/token?grant_type=password', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) throw new Error(`reset: login de ${email} falhou (${loginRes.status})`)
  const { access_token: token, user } = await loginRes.json()

  await api('/rest/v1/rpc/cancel_account_deletion', token, { method: 'POST', body: '{}' })
  await api(`/rest/v1/profiles?id=eq.${user.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ display_name: displayName, avatar_url: null }),
  })

  const profileRes = await api(`/rest/v1/profiles?id=eq.${user.id}&select=couple_id`, token)
  const [profile] = await profileRes.json()
  const coupleId: string | null = profile?.couple_id ?? null

  if (coupleId) {
    await api(`/rest/v1/posts?author_id=eq.${user.id}`, token, { method: 'DELETE' })
    await api(`/rest/v1/lists?couple_id=eq.${coupleId}`, token, { method: 'DELETE' })

    const listRes = await api('/storage/v1/object/list/post-photos', token, {
      method: 'POST',
      body: JSON.stringify({ prefix: coupleId, limit: 100 }),
    })
    if (listRes.ok) {
      const objects: { name: string }[] = await listRes.json()
      if (objects.length > 0) {
        await api('/storage/v1/object/post-photos', token, {
          method: 'DELETE',
          body: JSON.stringify({ prefixes: objects.map((o) => `${coupleId}/${o.name}`) }),
        })
      }
    }

    await api('/rest/v1/rpc/leave_couple', token, { method: 'POST', body: '{}' })
  }
}
