'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'

type MutateData = Record<string, unknown>

type UseListMutationOptions<T> = {
  queryKey: readonly [string, ...unknown[]]
  endpoint: string
  defaults?: Partial<T>
  onSuccessCreate?: string
  onSuccessUpdate?: string
  onSuccessDelete?: string
  onSuccess?: () => void
}

export function useListMutation<T extends { id: string | number }>({
  queryKey,
  endpoint,
  defaults,
  onSuccessCreate = 'Created successfully',
  onSuccessUpdate = 'Updated successfully',
  onSuccessDelete = 'Disabled successfully',
}: UseListMutationOptions<T>) {
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: (data: MutateData) => api.post<T>(endpoint, data).then((r) => {
      if (!r.success) throw new Error(r.error ?? 'Failed to create')
      return r.data!
    }),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: queryKey as unknown as string[] })
      const previous = qc.getQueryData<T[]>(queryKey as unknown as string[])
      qc.setQueryData<T[]>(queryKey as unknown as string[], (old) => [
        { ...defaults, ...newData, id: `temp-${Date.now()}` } as T,
        ...(old ?? []),
      ])
      return { previous }
    },
    onSuccess: () => { toast.success(onSuccessCreate) },
    onError: (_err, _newData, context) => {
      if (context?.previous) qc.setQueryData(queryKey as unknown as string[], context.previous)
      toast.error('Failed to create')
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: queryKey as unknown as string[] }) },
  })

  const update = useMutation({
    mutationFn: ({ id, ...data }: MutateData & { id: string | number }) =>
      api.put<T>(`${endpoint}/${id}`, data).then((r) => {
        if (!r.success) throw new Error(r.error ?? 'Failed to update')
        return r.data!
      }),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: queryKey as unknown as string[] })
      const previous = qc.getQueryData<T[]>(queryKey as unknown as string[])
      qc.setQueryData<T[]>(queryKey as unknown as string[], (old) =>
        (old ?? []).map((item) =>
          String((item as Record<string, unknown>).id) === String(id) ? { ...item, ...data } as T : item
        )
      )
      return { previous }
    },
    onSuccess: () => { toast.success(onSuccessUpdate) },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey as unknown as string[], context.previous)
      toast.error('Failed to update')
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: queryKey as unknown as string[] }) },
  })

  const remove = useMutation({
    mutationFn: (id: string | number) => api.delete(`${endpoint}/${id}`).then((r) => {
      if (!r.success) throw new Error(r.error ?? 'Failed to disable')
    }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKey as unknown as string[] })
      const previous = qc.getQueryData<T[]>(queryKey as unknown as string[])
      qc.setQueryData<T[]>(queryKey as unknown as string[], (old) =>
        (old ?? []).filter((item) => String((item as Record<string, unknown>).id) !== String(id))
      )
      return { previous }
    },
    onSuccess: () => { toast.success(onSuccessDelete) },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(queryKey as unknown as string[], context.previous)
      toast.error('Failed to disable')
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: queryKey as unknown as string[] }) },
  })

  const save = (data: MutateData, editing: T | null) => {
    if (editing) {
      update.mutate({ ...data, id: (editing as Record<string, unknown>).id as string | number })
    } else {
      create.mutate(data)
    }
  }

  return {
    create,
    update,
    remove,
    save,
    isPending: create.isPending || update.isPending || remove.isPending,
  }
}
