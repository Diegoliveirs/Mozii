import type { Repositories } from '../repositories'
import { SupabaseAuthRepository } from './SupabaseAuthRepository'
import { SupabaseCoupleRepository } from './SupabaseCoupleRepository'
import { SupabaseListRepository } from './SupabaseListRepository'
import { SupabaseFeedRepository } from './SupabaseFeedRepository'
import { SupabaseFavoriteRepository } from './SupabaseFavoriteRepository'
import { SupabaseStorageRepository } from './SupabaseStorageRepository'
import { SupabaseBillingRepository } from './SupabaseBillingRepository'

export function createSupabaseRepositories(): Repositories {
  return {
    auth: new SupabaseAuthRepository(),
    couple: new SupabaseCoupleRepository(),
    lists: new SupabaseListRepository(),
    feed: new SupabaseFeedRepository(),
    favorites: new SupabaseFavoriteRepository(),
    storage: new SupabaseStorageRepository(),
    billing: new SupabaseBillingRepository(),
  }
}
