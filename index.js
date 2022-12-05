'use strict'

const fp = require('fastify-plugin')
const { als } = require('asynchronous-local-storage')
const { AsyncResource } = require('async_hooks')
const asyncResourceSymbol = Symbol('asyncResource')

const requestContext = {
  get: als.get,
  set: als.set,
}

function fastifyRequestContext(fastify, opts, next) {
  fastify.decorate('requestContext', requestContext)
  fastify.decorateRequest('requestContext', { getter: () => requestContext })
  fastify.decorateRequest(asyncResourceSymbol, null)
  const hook = opts.hook || 'onRequest'

  fastify.addHook(hook, (req, res, done) => {
    const defaultStoreValues =
      typeof opts.defaultStoreValues === 'function'
        ? opts.defaultStoreValues()
        : opts.defaultStoreValues

    als.runWith(() => {
      const asyncResource = new AsyncResource('fastify-request-context')
      req[asyncResourceSymbol] = asyncResource
      asyncResource.runInAsyncScope(done, req.raw)
    }, defaultStoreValues)
  })

  // Both of onRequest and preParsing are executed after the als.runWith call within the "proper" async context (AsyncResource implicitly created by ALS).
  // However, preValidation, preHandler and the route handler are executed as a part of req.emit('end') call which happens
  // in a different async context, as req/res may emit events in a different context.
  // Related to https://github.com/nodejs/node/issues/34430 and https://github.com/nodejs/node/issues/33723
  if (hook === 'onRequest' || hook === 'preParsing') {
    fastify.addHook('preValidation', (req, res, done) => {
      const asyncResource = req[asyncResourceSymbol]
      asyncResource.runInAsyncScope(done, req.raw)
    })
  }

  next()
}

module.exports = fp(fastifyRequestContext, {
  fastify: '4.x',
  name: '@fastify/request-context',
})
module.exports.default = fastifyRequestContext
module.exports.fastifyRequestContext = fastifyRequestContext

module.exports.requestContext = requestContext

// Deprecated
module.exports.fastifyRequestContextPlugin = fastifyRequestContext
