import { Injectable, Logger } from '@nestjs/common'
import type { OwnedResource, LeveledResource } from '../domain/policies'

export type PolicyResource = OwnedResource & LeveledResource

/** Cargador que un módulo aporta para SUS recursos. Devuelve `null` si no existe. */
export type PolicyLoader = (id: string) => Promise<PolicyResource | null>

/**
 * Registro de cargadores de recursos, poblado por cada bounded context al
 * inicializarse (`onModuleInit`).
 *
 * Es la inversión de dependencia que permite a `PolicyGuard` autorizar sobre
 * cursos, posts o playlists sin importar nunca los repositorios de esos módulos.
 */
@Injectable()
export class PolicyRegistry {
  private readonly logger = new Logger(PolicyRegistry.name)
  private readonly loaders = new Map<string, PolicyLoader>()

  register(resource: string, loader: PolicyLoader): void {
    if (this.loaders.has(resource)) {
      throw new Error(`Ya existe un cargador de política para el recurso "${resource}"`)
    }
    this.loaders.set(resource, loader)
    this.logger.log(`Política registrada para el recurso "${resource}"`)
  }

  async load(resource: string, id: string): Promise<PolicyResource | null> {
    const loader = this.loaders.get(resource)
    if (!loader) {
      // Fallar cerrado: una ruta protegida cuyo recurso nadie registró
      // no debe abrirse por accidente.
      throw new Error(`No hay cargador de política para el recurso "${resource}"`)
    }
    return loader(id)
  }
}
