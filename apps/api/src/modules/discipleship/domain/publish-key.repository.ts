export interface PublishKeyEntity {
  id: string
  code: string
  createdBy: string
  usedBy: string | null
  usedCourseId: string | null
  usedAt: Date | null
  createdAt: Date
}

/** Puerto del repositorio de llaves de publicación. */
export abstract class PublishKeyRepository {
  abstract create(code: string, createdBy: string): Promise<PublishKeyEntity>
  abstract findByCode(code: string): Promise<PublishKeyEntity | null>
  abstract markUsed(id: string, usedBy: string, courseId: string): Promise<void>
  /** Todas las llaves, más recientes primero (panel de admin). */
  abstract findAll(): Promise<PublishKeyEntity[]>
}
