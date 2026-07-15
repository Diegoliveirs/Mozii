import type { Repositories } from '../repositories'
import { SupabaseAuthRepository } from './SupabaseAuthRepository'
import { SupabaseCoupleRepository } from './SupabaseCoupleRepository'
import { SupabaseListRepository } from './SupabaseListRepository'
import { SupabaseFeedRepository } from './SupabaseFeedRepository'
import { SupabaseStorageRepository } from './SupabaseStorageRepository'

export function createSupabaseRepositories(): Repositories {
  return {
    auth: new SupabaseAuthRepository(),
    couple: new SupabaseCoupleRepository(),
    lists: new SupabaseListRepository(),
    feed: new SupabaseFeedRepository(),
    storage: new SupabaseStorageRepository(),
  }
}
