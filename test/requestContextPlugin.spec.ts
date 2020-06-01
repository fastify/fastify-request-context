import fastify from 'fastify'
import { fastifyRequestContextPlugin } from '../lib/requestContextPlugin'
import { TestService } from './internal/testService'

async function initApp(endpoint: any) {
  const app = fastify({ logger: true })
  app.register(fastifyRequestContextPlugin)

  app.get('/', endpoint)

  await app.ready()
  return app
}

describe('requestContextPlugin', () => {
  let app: fastify.FastifyInstance

  afterEach(() => {
    return app.close()
  })

  it('correctly preserves values within single request', async () => {
    let responseCounter = 0
    const responsePromise = new Promise(async (resolveResponsePromise) => {
      const promiseRequest2 = new Promise(async (resolveRequest2Promise) => {
        const promiseRequest1 = new Promise(async (resolveRequest1Promise) => {
          app = await initApp(
            async (req: fastify.FastifyRequest, reply: fastify.FastifyReply<any>) => {
              const requestId = Number.parseInt(req.query.requestId)
              req.requestContext.set('testKey', `testValue${requestId}`)

              // We don't want to read values until both requests wrote their values to see if there is a racing condition
              if (requestId === 1) {
                resolveRequest1Promise()
                await promiseRequest2
              }

              if (requestId === 2) {
                resolveRequest2Promise()
                await promiseRequest1
              }

              await testService.processRequest(requestId)

              const storedValue: string | undefined = req.requestContext.get('testKey')
              reply.status(204).send({
                storedValue,
              })
            }
          )
          const testService = new TestService(app)

          const response1Promise = app
            .inject()
            .get('/')
            .query({ requestId: 1 })
            .end()
            .then((response) => {
              expect(response.json().storedValue).toBe('testValue1')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          const response2Promise = app
            .inject()
            .get('/')
            .query({ requestId: 2 })
            .end()
            .then((response) => {
              expect(response.json().storedValue).toBe('testValue2')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          await response1Promise
          await response2Promise
        })
      })
    })
    await responsePromise
  })
})
