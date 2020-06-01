import fp from 'fastify-plugin'
import als from 'asynchronous-local-storage'

import type { FastifyInstance } from 'fastify'
import type { nextCallback } from 'fastify-plugin'

export type RequestContext = {
  get: <T>(key: string) => T | undefined
  set: <T>(key: string, value: T) => void
}

export type RequestContextOptions = {
  defaultStoreValues?: Record<string, any>
}

declare module 'fastify' {
  export interface FastifyRequest<HttpRequest, Query, Params, Headers, Body> {
    requestContext: RequestContext
  }

  export interface FastifyInstance<HttpServer, HttpRequest, HttpResponse> {
    requestContext: RequestContext
  }
}

const requestContext: RequestContext = {
  get: als.get,
  set: als.set,
}

function plugin(fastify: FastifyInstance, opts: RequestContextOptions, next: nextCallback) {
  fastify.decorate('requestContext', requestContext)
  fastify.decorateRequest('requestContext', requestContext)

  fastify.addHook('onRequest', (req, res, done) => {
    als.runWith(() => {
      done()
    }, opts.defaultStoreValues)
  })
  next()
}

export const fastifyRequestContextPlugin = fp(plugin, {
  fastify: '2.x',
  name: 'fastify-request-context',
})
