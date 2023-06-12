'use strict'

const { AsyncLocalStorage, AsyncResource } = require('node:async_hooks')

const fp = require('fastify-plugin')

const asyncResourceSymbol = Symbol('asyncResource')

const asyncLocalStorage = new AsyncLocalStorage()

const requestContext = {
  get: (key) => {
    const store = asyncLocalStorage.getStore()
    return store ? store[key] : undefined
  },
  set: (key, value) => {
    const store = asyncLocalStorage.getStore()
    if (store) {
      store[key] = value
    }
  },
}

function fastifyRequestContext(fastify, opts, next) {
  fastify.decorate('requestContext', requestContext)
  fastify.decorateRequest('requestContext', { getter: () => requestContext })
  fastify.decorateRequest(asyncResourceSymbol, null)
  const hook = opts.hook || 'onRequest'
  const hasDefaultStoreValuesFactory = typeof opts.defaultStoreValues === 'function'

  fastify.addHook(hook, (req, res, done) => {
    const defaultStoreValues = hasDefaultStoreValuesFactory
      ? opts.defaultStoreValues(req)
      : opts.defaultStoreValues

    asyncLocalStorage.run({ ...defaultStoreValues }, () => {
      const asyncResource = new AsyncResource('fastify-request-context')
      req[asyncResourceSymbol] = asyncResource
      asyncResource.runInAsyncScope(done, req.raw)
    })
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
