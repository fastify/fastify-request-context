import {
  requestContext,
  fastifyRequestContext,
  FastifyRequestContextOptions,
  RequestContext,
  RequestContextDataFactory,
} from '..'
import { expectAssignable, expectType } from 'tsd'
import { FastifyInstance, RouteHandlerMethod } from 'fastify'

const fastify = require('fastify')

const app: FastifyInstance = fastify()
app.register(fastifyRequestContext)

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

expectType<RequestContext>(app.requestContext)
expectType<RequestContext>(requestContext)

const getHandler: RouteHandlerMethod = function (request, _reply) {
  expectType<RequestContext>(request.requestContext)
}

declare module './index' {
  interface RequestContextData {
    foo?: string
  }
}

expectType<string | undefined>(requestContext.get('foo'))
expectType<any>(requestContext.get('bar'))
