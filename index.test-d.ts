import {
  requestContext,
  fastifyRequestContextPlugin,
  RequestContextOptions,
  RequestContext,
} from './index'
import { expectAssignable, expectType } from 'tsd'
import { FastifyInstance, RouteHandlerMethod } from 'fastify'

const fastify = require('fastify')

const app: FastifyInstance = fastify()
app.register(fastifyRequestContextPlugin)

expectAssignable<RequestContextOptions>({})
expectAssignable<RequestContextOptions>({
  defaultStoreValues: { a: 'dummy' },
})
expectAssignable<RequestContextOptions>({
  hook: 'preValidation',
  defaultStoreValues: { a: 'dummy' },
})

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
