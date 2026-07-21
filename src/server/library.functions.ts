import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  adminWorkUpdateSchema,
  bulkCreateWorkSchema,
  bulkUpdateWorksSchema,
  createWorkSchema,
} from "@/features/library/model"

export const getWorks = createServerFn({ method: "GET" }).handler(async () => {
  const { listWorks } = await import("@/db/repository")
  return listWorks()
})

export const addWork = createServerFn({ method: "POST" })
  .validator(createWorkSchema)
  .handler(async ({ data }) => {
    const { createWork } = await import("@/db/repository")
    return createWork(data)
  })

export const setWorkFavorite = createServerFn({ method: "POST" })
  .validator(z.object({ workId: z.string(), favorite: z.boolean() }))
  .handler(async ({ data }) => {
    const { updateFavorite } = await import("@/db/repository")
    return updateFavorite(data.workId, data.favorite)
  })

export const saveWork = createServerFn({ method: "POST" })
  .validator(adminWorkUpdateSchema)
  .handler(async ({ data }) => {
    const { updateWork } = await import("@/db/repository")
    return updateWork(data)
  })

export const addWorksBulk = createServerFn({ method: "POST" })
  .validator(bulkCreateWorkSchema)
  .handler(async ({ data }) => {
    const { createWorksBulk } = await import("@/db/repository")
    return createWorksBulk(data.works)
  })

export const editWorksBulk = createServerFn({ method: "POST" })
  .validator(bulkUpdateWorksSchema)
  .handler(async ({ data }) => {
    const { updateWorksBulk } = await import("@/db/repository")
    return updateWorksBulk(data)
  })
