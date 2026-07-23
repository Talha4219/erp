export type ApiResult<T> = {
  success: boolean
  data: T | null
  error: string | null
}

export type ListQueryKey = readonly [string, ...unknown[]]

export type MutationState = {
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}
