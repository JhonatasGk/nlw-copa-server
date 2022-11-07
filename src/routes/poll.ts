import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import ShortUniqueId from 'short-unique-id'
import { z } from 'zod'
import { authenticate } from '../plugins/authenticate'

export async function pollRoutes(fastify: FastifyInstance) {
  fastify.get('/polls/count', async () => {
    const count = await prisma.poll.count()

    return { count }
  })
  fastify.post('/polls', { onRequest: [authenticate] }, async (req, rep) => {
    const createPollBody = z.object({
      title: z.string()
    })
    const { title } = createPollBody.parse(req.body)

    const uid = new ShortUniqueId({ length: 6 })
    const code = String(uid()).toUpperCase()

    try {
      await req.jwtVerify()

      await prisma.poll.create({
        data: {
          title,
          code: code,
          ownerId: req.user.sub,

          participants: {
            create: { userId: req.user.sub }
          }
        }
      })
    } catch (err) {
      await prisma.poll.create({
        data: {
          title,
          code: code
        }
      })
    }

    return rep.status(201).send({ code })
  })
  fastify.post(
    '/polls/join',
    { onRequest: [authenticate] },
    async (req, rep) => {
      const joinPollBody = z.object({ code: z.string() })

      const { code } = joinPollBody.parse(req.body)

      const poll = await prisma.poll.findUnique({
        where: {
          code
        },
        include: { participants: { where: { userId: req.user.sub } } }
      })

      if (!poll) {
        return rep.status(400).send({ message: 'Poll not found' })
      }

      if (poll.participants.length > 0) {
        return rep.status(400).send({ message: 'You already joined this poll' })
      }

      if (!poll.ownerId) {
        await prisma.poll.update({
          where: { id: poll.id },
          data: { ownerId: req.user.sub }
        })
      }
      await prisma.participant.create({
        data: { pollId: poll.id, userId: req.user.sub }
      })

      return rep.status(201).send()
    }
  )

  fastify.get('/polls', { onRequest: [authenticate] }, async req => {
    const polls = await prisma.poll.findMany({
      where: { participants: { some: { userId: req.user.sub } } },
      include: {
        _count: { select: { participants: true } },
        participants: {
          select: { id: true, user: { select: { avatarUrl: true } } },
          take: 4
        },
        owner: { select: { id: true, name: true } }
      }
    })

    return { polls }
  })
  fastify.get('/polls/:id', { onRequest: [authenticate] }, async req => {
    const getPollParams = z.object({ id: z.string() })

    const { id } = getPollParams.parse(req.params)

    const polls = await prisma.poll.findUnique({
      where: { id },
      include: {
        _count: { select: { participants: true } },
        participants: {
          select: { id: true, user: { select: { avatarUrl: true } } },
          take: 4
        },
        owner: { select: { id: true, name: true } }
      }
    })
    return { polls }
  })
}
