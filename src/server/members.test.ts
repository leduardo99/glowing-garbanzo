import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'

import { itinerary, itineraryMember } from '#/db/schema'
import {
  closeTestDb,
  createTestUser,
  resetTestDb,
  setupTestDb,
  testDb,
} from '#/test/db'
import {
  createItineraryImpl,
  getItineraryBySlugImpl,
  publishItineraryImpl,
  updateItineraryImpl,
} from './itineraries'
import {
  joinByInviteTokenImpl,
  listMembersImpl,
  regenerateInviteTokenImpl,
  removeMemberImpl,
  revokeInviteTokenImpl,
} from './members'

describe('members & invite-link server functions', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
  })

  afterAll(async () => {
    await resetTestDb()
    await closeTestDb()
  })

  /** Creates + publishes a private itinerary owned by `authorId`. */
  async function publishedPrivateItinerary(authorId: string) {
    const created = await createItineraryImpl(
      testDb,
      { user: { id: authorId } },
      {
        title: 'Secret Getaway',
        destination: 'Fernando de Noronha',
      },
    )
    await updateItineraryImpl(
      testDb,
      { user: { id: authorId } },
      {
        id: created.id,
        visibility: 'private',
      },
    )
    await publishItineraryImpl(
      testDb,
      { user: { id: authorId } },
      { id: created.id },
    )
    return created
  }

  async function publishedPublicItinerary(authorId: string) {
    const created = await createItineraryImpl(
      testDb,
      { user: { id: authorId } },
      {
        title: 'Public Trip',
        destination: 'Rio',
      },
    )
    await publishItineraryImpl(
      testDb,
      { user: { id: authorId } },
      { id: created.id },
    )
    return created
  }

  describe('regenerateInviteTokenImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        regenerateInviteTokenImpl(testDb, null, { id: created.id }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects a non-author (forbidden)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        regenerateInviteTokenImpl(
          testDb,
          { user: { id: stranger.id } },
          { id: created.id },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('rejects an unknown itinerary (not found)', async () => {
      const author = await createTestUser()

      await expect(
        regenerateInviteTokenImpl(
          testDb,
          { user: { id: author.id } },
          { id: 'does-not-exist' },
        ),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('rejects a public itinerary (forbidden — readable but wrong state)', async () => {
      const author = await createTestUser()
      const created = await publishedPublicItinerary(author.id)

      await expect(
        regenerateInviteTokenImpl(
          testDb,
          { user: { id: author.id } },
          { id: created.id },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('generates a 24-char token and persists it', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      const result = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )
      expect(result.inviteToken).toHaveLength(24)

      const row = await testDb.query.itinerary.findFirst({
        where: eq(itinerary.id, created.id),
      })
      expect(row?.inviteToken).toBe(result.inviteToken)
    })

    it('regenerating replaces the previous token', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      const first = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )
      const second = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )

      expect(second.inviteToken).not.toBe(first.inviteToken)

      const row = await testDb.query.itinerary.findFirst({
        where: eq(itinerary.id, created.id),
      })
      expect(row?.inviteToken).toBe(second.inviteToken)
    })
  })

  describe('revokeInviteTokenImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        revokeInviteTokenImpl(testDb, null, { id: created.id }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects a non-author (forbidden)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        revokeInviteTokenImpl(
          testDb,
          { user: { id: stranger.id } },
          { id: created.id },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('rejects a public itinerary (forbidden)', async () => {
      const author = await createTestUser()
      const created = await publishedPublicItinerary(author.id)

      await expect(
        revokeInviteTokenImpl(
          testDb,
          { user: { id: author.id } },
          { id: created.id },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('sets the token to null', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )

      await revokeInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )

      const row = await testDb.query.itinerary.findFirst({
        where: eq(itinerary.id, created.id),
      })
      expect(row?.inviteToken).toBeNull()
    })
  })

  describe('joinByInviteTokenImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )

      await expect(
        joinByInviteTokenImpl(testDb, null, {
          slug: created.slug,
          token: inviteToken,
        }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects an invalid token (not found)', async () => {
      const author = await createTestUser()
      const joiner = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )

      await expect(
        joinByInviteTokenImpl(
          testDb,
          { user: { id: joiner.id } },
          {
            slug: created.slug,
            token: 'totally-bogus-token',
          },
        ),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('rejects a valid token on an unpublished draft (not found — mirrors the Task 4 fix)', async () => {
      const author = await createTestUser()
      const joiner = await createTestUser()
      const created = await createItineraryImpl(
        testDb,
        { user: { id: author.id } },
        {
          title: 'Draft private trip',
          destination: 'Nowhere',
        },
      )
      await updateItineraryImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
          visibility: 'private',
        },
      )
      // Not published — draft private itineraries must stay author-only,
      // even if a token happens to be set.
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )

      await expect(
        joinByInviteTokenImpl(
          testDb,
          { user: { id: joiner.id } },
          {
            slug: created.slug,
            token: inviteToken,
          },
        ),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('rejects a token against a public itinerary (not found)', async () => {
      const author = await createTestUser()
      const joiner = await createTestUser()
      const created = await publishedPublicItinerary(author.id)

      await expect(
        joinByInviteTokenImpl(
          testDb,
          { user: { id: joiner.id } },
          {
            slug: created.slug,
            token: 'anything',
          },
        ),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('lets the author "join" their own itinerary without error (no-op success)', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )

      const result = await joinByInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )
      expect(result).toEqual({ slug: created.slug })
    })

    it('is idempotent on repeat joins (no duplicate row, no error)', async () => {
      const author = await createTestUser()
      const joiner = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )

      await joinByInviteTokenImpl(
        testDb,
        { user: { id: joiner.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )
      const second = await joinByInviteTokenImpl(
        testDb,
        { user: { id: joiner.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )
      expect(second).toEqual({ slug: created.slug })

      const rows = await testDb.query.itineraryMember.findMany({
        where: and(
          eq(itineraryMember.itineraryId, created.id),
          eq(itineraryMember.userId, joiner.id),
        ),
      })
      expect(rows).toHaveLength(1)
    })

    it('full verification chain: join grants read access without the token; revoke/regenerate blocks new joiners but not existing members; removal revokes access', async () => {
      const author = await createTestUser()
      const joiner = await createTestUser('Joiner One')
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken: firstToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )

      // Before joining: no read access at all (not even NOT_FOUND leak-proofing bypassed).
      await expect(
        getItineraryBySlugImpl(
          testDb,
          { user: { id: joiner.id } },
          { slug: created.slug },
        ),
      ).rejects.toThrow('NOT_FOUND')

      // Join with the valid token.
      const joinResult = await joinByInviteTokenImpl(
        testDb,
        { user: { id: joiner.id } },
        {
          slug: created.slug,
          token: firstToken,
        },
      )
      expect(joinResult).toEqual({ slug: created.slug })

      // Now the member can read WITHOUT presenting the token.
      const detail = await getItineraryBySlugImpl(
        testDb,
        { user: { id: joiner.id } },
        {
          slug: created.slug,
        },
      )
      expect(detail.viewer.isMember).toBe(true)

      // Regenerate the token — the old token must no longer let a NEW joiner in...
      const secondJoiner = await createTestUser('Joiner Two')
      const { inviteToken: secondToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )
      expect(secondToken).not.toBe(firstToken)

      await expect(
        joinByInviteTokenImpl(
          testDb,
          { user: { id: secondJoiner.id } },
          {
            slug: created.slug,
            token: firstToken,
          },
        ),
      ).rejects.toThrow('NOT_FOUND')

      // ...but the existing member's access is untouched by token rotation.
      await expect(
        getItineraryBySlugImpl(
          testDb,
          { user: { id: joiner.id } },
          { slug: created.slug },
        ),
      ).resolves.toMatchObject({ viewer: { isMember: true } })

      // The new token does let the second joiner in.
      const secondJoinResult = await joinByInviteTokenImpl(
        testDb,
        { user: { id: secondJoiner.id } },
        {
          slug: created.slug,
          token: secondToken,
        },
      )
      expect(secondJoinResult).toEqual({ slug: created.slug })

      // Revoking the token blocks any further joins, even with the last-known-good token.
      await revokeInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )
      const thirdJoiner = await createTestUser('Joiner Three')
      await expect(
        joinByInviteTokenImpl(
          testDb,
          { user: { id: thirdJoiner.id } },
          {
            slug: created.slug,
            token: secondToken,
          },
        ),
      ).rejects.toThrow('NOT_FOUND')

      // Existing members (both joiners) still have access after revocation.
      await expect(
        getItineraryBySlugImpl(
          testDb,
          { user: { id: joiner.id } },
          { slug: created.slug },
        ),
      ).resolves.toMatchObject({ viewer: { isMember: true } })
      await expect(
        getItineraryBySlugImpl(
          testDb,
          { user: { id: secondJoiner.id } },
          { slug: created.slug },
        ),
      ).resolves.toMatchObject({ viewer: { isMember: true } })

      // Removing a member revokes their access entirely.
      await removeMemberImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
          userId: joiner.id,
        },
      )
      await expect(
        getItineraryBySlugImpl(
          testDb,
          { user: { id: joiner.id } },
          { slug: created.slug },
        ),
      ).rejects.toThrow('NOT_FOUND')

      // The other member is unaffected.
      await expect(
        getItineraryBySlugImpl(
          testDb,
          { user: { id: secondJoiner.id } },
          { slug: created.slug },
        ),
      ).resolves.toMatchObject({ viewer: { isMember: true } })
    })
  })

  describe('listMembersImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        listMembersImpl(testDb, null, { id: created.id }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects a non-author (forbidden)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        listMembersImpl(
          testDb,
          { user: { id: stranger.id } },
          { id: created.id },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('lists members with id/name/image + createdAt', async () => {
      const author = await createTestUser()
      const member1 = await createTestUser('Alice')
      const member2 = await createTestUser('Bob')
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )

      await joinByInviteTokenImpl(
        testDb,
        { user: { id: member1.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )
      await joinByInviteTokenImpl(
        testDb,
        { user: { id: member2.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )

      const members = await listMembersImpl(
        testDb,
        { user: { id: author.id } },
        { id: created.id },
      )
      expect(members).toHaveLength(2)
      const names = members.map((m) => m.member.name).sort()
      expect(names).toEqual(['Alice', 'Bob'])
      for (const m of members) {
        expect(m.createdAt).toBeInstanceOf(Date)
        expect(m.member.id).toBeDefined()
        expect(m.member.image).toBeNull()
      }
    })
  })

  describe('removeMemberImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        removeMemberImpl(testDb, null, { id: created.id, userId: author.id }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects a non-author (forbidden)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const member = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )
      await joinByInviteTokenImpl(
        testDb,
        { user: { id: member.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )

      await expect(
        removeMemberImpl(
          testDb,
          { user: { id: stranger.id } },
          { id: created.id, userId: member.id },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('rejects removing a non-member (not found)', async () => {
      const author = await createTestUser()
      const notAMember = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)

      await expect(
        removeMemberImpl(
          testDb,
          { user: { id: author.id } },
          {
            id: created.id,
            userId: notAMember.id,
          },
        ),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('removes the member row', async () => {
      const author = await createTestUser()
      const member = await createTestUser()
      const created = await publishedPrivateItinerary(author.id)
      const { inviteToken } = await regenerateInviteTokenImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
        },
      )
      await joinByInviteTokenImpl(
        testDb,
        { user: { id: member.id } },
        {
          slug: created.slug,
          token: inviteToken,
        },
      )

      await removeMemberImpl(
        testDb,
        { user: { id: author.id } },
        {
          id: created.id,
          userId: member.id,
        },
      )

      const row = await testDb.query.itineraryMember.findFirst({
        where: and(
          eq(itineraryMember.itineraryId, created.id),
          eq(itineraryMember.userId, member.id),
        ),
      })
      expect(row).toBeUndefined()
    })
  })
})
