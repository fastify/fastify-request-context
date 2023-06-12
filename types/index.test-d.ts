import {
  requestContext,
  fastifyRequestContext,
  FastifyRequestContextOptions,
  RequestContext,
  RequestContextDataFactory,
} from '..'
import { expectAssignable, expectType, expectError } from 'tsd'
import { FastifyBaseLogger, FastifyInstance, RouteHandlerMethod } from 'fastify'

const fastify = require('fastify')

const app: FastifyInstance = fastify()
app.register(fastifyRequestContext)

declare module './index' {
  interface RequestContextData {
    a?: string,
    log?: FastifyBaseLogger
  }
}

expectAssignable<FastifyRequestContextOptions>({})
expectAssignable<FastifyRequestContextOptions>({
  defaultStoreValues: { a: 'dummy' },
})
expectAssignable<FastifyRequestContextOptions>({
  hook: 'preValidation',
  defaultStoreValues: { a: 'dummy' },
})
expectAssignable<FastifyRequestContextOptions>({
  defaultStoreValues: () => ({
    a: 'dummy'
  })
})

expectError<FastifyRequestContextOptions>({
  defaultStoreValues: { bar: 'dummy' },
})

expectError<FastifyRequestContextOptions>({
  defaultStoreValues: { log: 'dummy' },
})

expectAssignable<RequestContextDataFactory>(() => ({
  a: 'dummy'
}))

expectAssignable<FastifyRequestContextOptions>({
  defaultStoreValues: req => ({
    log: req.log.child({ childLog: true })
  })
})

expectAssignable<RequestContextDataFactory>(req => ({
  log: req.log.child({ childLog: true })
}))

expectError<RequestContextDataFactory>(req => ({ bar: 'dummy' }))
expectError<RequestContextDataFactory>(req => ({ log: 'dummy' }))

expectType<RequestContext>(app.requestContext)
expectType<RequestContext>(requestContext)

const getHandler: RouteHandlerMethod = function (request, _reply) {
  expectType<RequestContext>(request.requestContext)
}

expectType<string | undefined>(requestContext.get('a'))
expectType<FastifyBaseLogger | undefined>(requestContext.get('log'))

expectError(requestContext.get('bar'))

// Test exactOptionalPropertyTypes: true

requestContext.set('a', undefined) // Should not error
expectError(requestContext.set('a', 123))
expectError<FastifyRequestContextOptions>({
  defaultStoreValues: { a: undefined },
})
