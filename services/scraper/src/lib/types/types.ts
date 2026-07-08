import { z } from "zod"

const TIME_FILTER = ["1D", "1W", "1M", "default"] as const
export const timeFilterSchema = z.enum(TIME_FILTER)
export type TimeFilter = z.infer<typeof timeFilterSchema>
