'use client'

import { useMutation, useQuery } from 'convex/react'
import { useCallback, useMemo } from 'react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import type { ElementRole, ExclusionStatus, NorthSource, ProjectInputs, RunResult, Scheme } from '@/lib/edge/types'
import type { PackManifest } from '@/lib/export/manifest'
import { fromClassificationRow, fromExclusionRow, fromStoredRun, toStoredRun } from './codec'

export type ProjectId = Id<'projects'>
export type RunDocId = Id<'runs'>

/** What identifies a project's model. The schemes and inputs the person picks are set separately and never overwritten here. */
export type ProjectIdentity = {
  slug: string
  modelUrn: string
  modelName: string
  viewableName: string
  viewableGuid: string
  northAngleDeg: number
  northSource: NorthSource
}

const skipUnless = <T, A>(value: T | null | undefined, args: (v: T) => A): A | 'skip' =>
  value === null || value === undefined ? 'skip' : args(value)

export function useProject(slug: string | null | undefined) {
  return useQuery(api.projects.getBySlug, skipUnless(slug, (s) => ({ slug: s })))
}

/** The newest stored run rebuilt as a RunResult with element ids reassembled, plus its Convex id.
 * `undefined` while loading, `null` when the project has no run yet. */
export function useLatestRun(projectId: ProjectId | null | undefined) {
  const result = useQuery(api.runs.latest, skipUnless(projectId, (id) => ({ projectId: id })))
  return useMemo(() => {
    if (result === undefined || result === null) return result
    return {
      runDocId: result.run._id,
      run: fromStoredRun(result.run, result.elements, result.classifications, result.exclusions),
    }
  }, [result])
}

export function useRunHistory(projectId: ProjectId | null | undefined) {
  return useQuery(api.runs.list, skipUnless(projectId, (id) => ({ projectId: id })))
}

export function useClassifications(projectId: ProjectId | null | undefined) {
  const rows = useQuery(api.classifications.listByProject, skipUnless(projectId, (id) => ({ projectId: id })))
  return useMemo(() => rows?.map(fromClassificationRow), [rows])
}

/** Every exclusion row with its stored status, rejected ones included, so a later run does not propose them as new. */
export function useExclusions(projectId: ProjectId | null | undefined) {
  const rows = useQuery(api.exclusions.listByProject, skipUnless(projectId, (id) => ({ projectId: id })))
  return useMemo(() => rows?.map(fromExclusionRow), [rows])
}

export function useUpsertProject() {
  const upsert = useMutation(api.projects.upsert)
  return useCallback((project: ProjectIdentity) => upsert(project), [upsert])
}

export function useSaveRun() {
  const save = useMutation(api.runs.save)
  return useCallback(
    (projectId: ProjectId, run: RunResult) => save({ projectId, ...toStoredRun(run) }),
    [save],
  )
}

export function useConfirmType() {
  const confirm = useMutation(api.classifications.confirm)
  return useCallback(
    (projectId: ProjectId, typeKey: string, role: ElementRole) => confirm({ projectId, typeKey, role }),
    [confirm],
  )
}

/** Unconfirming deletes the person's row, so the rules or the model answer for the type again. */
export function useUnconfirmType() {
  const unconfirm = useMutation(api.classifications.unconfirm)
  return useCallback((projectId: ProjectId, typeKey: string) => unconfirm({ projectId, typeKey }), [unconfirm])
}

export function useDecideExclusion() {
  const decide = useMutation(api.exclusions.decide)
  return useCallback(
    (projectId: ProjectId, id: string, status: ExclusionStatus) => decide({ projectId, id, status }),
    [decide],
  )
}

export function useSetNorth() {
  const setNorth = useMutation(api.projects.setNorth)
  return useCallback(
    (projectId: ProjectId, northAngleDeg: number, northSource: NorthSource) =>
      setNorth({ projectId, northAngleDeg, northSource }),
    [setNorth],
  )
}

/** The selection shows at once: the project query takes it before the server confirms. */
export function useSetSchemes() {
  const setSchemes = useMutation(api.projects.setSchemes).withOptimisticUpdate((store, { projectId, schemes }) => {
    for (const { args, value } of store.getAllQueries(api.projects.getBySlug)) {
      if (value?._id === projectId) store.setQuery(api.projects.getBySlug, args, { ...value, schemes })
    }
  })
  return useCallback((projectId: ProjectId, schemes: Scheme[]) => setSchemes({ projectId, schemes }), [setSchemes])
}

export function useSetInputs() {
  const setInputs = useMutation(api.projects.setInputs).withOptimisticUpdate((store, { projectId, inputs }) => {
    for (const { args, value } of store.getAllQueries(api.projects.getBySlug)) {
      if (value?._id === projectId) store.setQuery(api.projects.getBySlug, args, { ...value, inputs })
    }
  })
  return useCallback((projectId: ProjectId, inputs: ProjectInputs) => setInputs({ projectId, inputs }), [setInputs])
}

export function useSavePack() {
  const save = useMutation(api.packs.save)
  return useCallback(
    (runId: RunDocId, url: string, size: number, manifest: PackManifest) => save({ runId, url, size, manifest }),
    [save],
  )
}

export function useLatestPack(runId: RunDocId | null | undefined) {
  return useQuery(api.packs.latestForRun, skipUnless(runId, (id) => ({ runId: id })))
}
