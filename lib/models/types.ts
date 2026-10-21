export type TranslationStatus = 'pending' | 'inprogress' | 'success' | 'failed'

export type ViewableRole = '3d' | '2d'

export interface Viewable {
  guid: string
  name: string
  role: ViewableRole
  isMasterView: boolean
}

export interface BucketModel {
  objectKey: string
  /** URL-safe id used in `/p/[slug]`, derived from objectKey. */
  slug: string
  /** Base64url Model Derivative URN. */
  urn: string
  name: string
  sizeBytes: number
  translation: TranslationStatus
  viewables: Viewable[]
  /** guid of the viewable the viewer should open; absent when nothing is translated. */
  preferredViewable?: string
}

export interface ModelCatalog {
  bucket: string
  models: BucketModel[]
}
