export interface AccessContext {
  userId: string | null
  isMember: boolean
}

export interface ItineraryAccessData {
  authorId: string
  status: 'draft' | 'published'
  visibility: 'public' | 'private'
}

function isAuthor(it: ItineraryAccessData, ctx: AccessContext): boolean {
  return ctx.userId !== null && ctx.userId === it.authorId
}

/**
 * Drafts are visible only to their author. Published+public itineraries
 * are readable by anyone, including anonymous visitors. Published+private
 * itineraries are readable by the author and by members.
 */
export function canRead(it: ItineraryAccessData, ctx: AccessContext): boolean {
  if (it.status === 'draft') {
    return isAuthor(it, ctx)
  }
  if (it.visibility === 'public') {
    return true
  }
  return isAuthor(it, ctx) || (ctx.userId !== null && ctx.isMember)
}

/** Only the author can edit an itinerary, regardless of status or visibility. */
export function canEdit(it: ItineraryAccessData, ctx: AccessContext): boolean {
  return isAuthor(it, ctx)
}

/** Rating is allowed only on published PUBLIC itineraries, by a logged-in user. */
export function canRate(it: ItineraryAccessData, ctx: AccessContext): boolean {
  return (
    ctx.userId !== null &&
    it.status === 'published' &&
    it.visibility === 'public'
  )
}
