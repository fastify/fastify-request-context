const fp = require('fastify-plugin')
const { als } = require('asynchronous-local-storage')

const requestContext = {
  get: als.get,
  set: als.set,
}

function plugin(fastify, opts, next) {
  fastify.decorate('requestContext', requestContext)
  fastify.decorateRequest('requestContext', requestContext)

  fastify.addHook(opts.hook || 'preValidation', (req, res, done) => {
    als.runWith(() => {
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
