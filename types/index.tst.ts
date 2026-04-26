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

expect({}).type.toBeAssignableTo<FastifyRequestContextOptions>()

expect({
  defaultStoreValues: { a: 'dummy' },
}).type.toBeAssignableTo<FastifyRequestContextOptions>()

expect({
  hook: 'preValidation' as const,
  defaultStoreValues: { a: 'dummy' },
}).type.toBeAssignableTo<FastifyRequestContextOptions>()

expect({
  defaultStoreValues: () => ({
    a: 'dummy',
  }),
}).type.toBeAssignableTo<FastifyRequestContextOptions>()

expect({
  defaultStoreValues: { bar: 'dummy' },
}).type.not.toBeAssignableTo<FastifyRequestContextOptions>()

expect({
  defaultStoreValues: { log: 'dummy' },
}).type.not.toBeAssignableTo<FastifyRequestContextOptions>()

expect(() => ({
  a: 'dummy',
})).type.toBeAssignableTo<RequestContextDataFactory>()

expect({
  defaultStoreValues: (req: FastifyRequest) => ({
    log: req.log.child({ childLog: true }),
  }),
}).type.toBeAssignableTo<FastifyRequestContextOptions>()

expect((req: FastifyRequest) => ({
  log: req.log.child({ childLog: true }),
})).type.toBeAssignableTo<RequestContextDataFactory>()

expect(() => ({ bar: 'dummy' })).type.not.toBeAssignableTo<RequestContextDataFactory>()

expect(() => ({ log: 'dummy' })).type.not.toBeAssignableTo<RequestContextDataFactory>()

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

expect({
  defaultStoreValues: { a: undefined },
}).type.not.toBeAssignableTo<FastifyRequestContextOptions>()
