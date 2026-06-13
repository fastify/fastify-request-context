import {
  requestContext,
  asyncLocalStorage,
  fastifyRequestContext,
  FastifyRequestContextOptions,
  RequestContext,
  RequestContextDataFactory,
} from '..'
import { expect } from 'tstyche'
import { fastify, FastifyBaseLogger, FastifyInstance, RouteHandlerMethod, FastifyRequest } from 'fastify'
import { AsyncLocalStorage } from 'node:async_hooks'

const app: FastifyInstance = fastify()
app.register(fastifyRequestContext)

declare module '..' {
  interface RequestContextData {
    a?: string
    log?: FastifyBaseLogger
  }
}

expect<FastifyRequestContextOptions>().type.toBeAssignableFrom({})

expect<FastifyRequestContextOptions>().type.toBeAssignableFrom({
  defaultStoreValues: { a: 'dummy' },
})

expect<FastifyRequestContextOptions>().type.toBeAssignableFrom({
  hook: 'preValidation' as const,
  defaultStoreValues: { a: 'dummy' },
})

expect<FastifyRequestContextOptions>().type.toBeAssignableFrom({
  defaultStoreValues: () => ({
    a: 'dummy',
  }),
})

expect<FastifyRequestContextOptions>().type.not.toBeAssignableFrom({
  defaultStoreValues: { bar: 'dummy' },
})

expect<FastifyRequestContextOptions>().type.not.toBeAssignableFrom({
  defaultStoreValues: { log: 'dummy' },
})

expect<RequestContextDataFactory>().type.toBeAssignableFrom(() => ({
  a: 'dummy',
}))

expect<FastifyRequestContextOptions>().type.toBeAssignableFrom({
  defaultStoreValues: (req: FastifyRequest) => ({
    log: req.log.child({ childLog: true }),
  }),
})

expect<RequestContextDataFactory>().type.toBeAssignableFrom((req: FastifyRequest) => ({
  log: req.log.child({ childLog: true }),
}))

expect<RequestContextDataFactory>().type.not.toBeAssignableFrom(() => ({ bar: 'dummy' }))

expect<RequestContextDataFactory>().type.not.toBeAssignableFrom(() => ({ log: 'dummy' }))

expect(app.requestContext).type.toBe<RequestContext>()
expect(requestContext).type.toBe<RequestContext>()
expect(asyncLocalStorage).type.toBe<AsyncLocalStorage<RequestContext>>()

const getHandler: RouteHandlerMethod = function (request, _reply) {
  expect(request.requestContext).type.toBe<RequestContext>()
}
expect(getHandler).type.toBe<RouteHandlerMethod>()

expect(requestContext.get('a')).type.toBe<string | undefined>()
expect(requestContext.get('log')).type.toBe<FastifyBaseLogger | undefined>()

// @ts-expect-error: Argument of type '"bar"' is not assignable
requestContext.get('bar')

requestContext.set('a', undefined)

// @ts-expect-error: Argument of type 'number' is not assignable
requestContext.set('a', 123)

expect<FastifyRequestContextOptions>().type.not.toBeAssignableFrom({
  defaultStoreValues: { a: undefined },
})
