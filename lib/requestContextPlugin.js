const fp = require('fastify-plugin')
const { als } = require('asynchronous-local-storage')

const requestContext = {
  get: als.get,
  set: als.set,
}

/**
 * Monkey patches `.emit()` method of the given emitter, so
 * that all event listeners are run in scope of the provided
 * async resource.
 */
const wrapEmitter = (emitter, asyncResource) => {
  const original = emitter.emit
  emitter.emit = function (type, ...args) {
    return asyncResource.runInAsyncScope(original, emitter, type, ...args)
  }
}

let AsyncResource
const wrapHttpEmitters = (req, res) => {
  if (als.storageImplementation === 'AsyncLocalStorage') {
    if (!AsyncResource) {
      AsyncResource = require('async_hooks').AsyncResource
    }

    const asyncResource = new AsyncResource('fastify-request-context')
    wrapEmitter(req, asyncResource)
    wrapEmitter(res, asyncResource)
  }
}

function plugin(fastify, opts, next) {
  fastify.decorate('requestContext', requestContext)
  fastify.decorateRequest('requestContext', requestContext)

  fastify.addHook(opts.hook || 'onRequest', (req, res, done) => {
    als.runWith(() => {
      wrapHttpEmitters(req.raw, res.raw)
      done()
    }, opts.defaultStoreValues)
  })
  next()
}

const fastifyRequestContextPlugin = fp(plugin, {
  fastify: '3.x',
  name: 'fastify-request-context',
})

module.exports = {
  fastifyRequestContextPlugin,
}
