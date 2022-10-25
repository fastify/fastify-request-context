const fastify = require('fastify')
const { fastifyRequestContextPlugin } = require('../../lib/requestContextPlugin')

function initAppGet(endpoint) {
  const app = fastify({ logger: true })
  app.register(fastifyRequestContextPlugin)

  app.get('/', endpoint)
  return app
}

function initAppPost(endpoint) {
  const app = fastify({ logger: true })
  app.register(fastifyRequestContextPlugin)

  app.post('/', endpoint)

  return app
}

function initAppPostWithPrevalidation(endpoint) {
  const app = fastify({ logger: true })
  app.register(fastifyRequestContextPlugin, { hook: 'preValidation' })

  const preValidationFn = (req, reply, done) => {
    const requestId = Number.parseInt(req.body.requestId)
    req.requestContext.set('testKey', `testValue${requestId}`)
    done()
  }

  app.route({
    url: '/',
    method: ['GET', 'POST'],
    preValidation: preValidationFn,
    handler: endpoint,
  })

  return app
}

function initAppPostWithAllPlugins(endpoint, requestHook) {
  const app = fastify({ logger: true })
  app.register(fastifyRequestContextPlugin, { hook: requestHook })

  app.addHook('onRequest', (req, reply, done) => {
    req.requestContext.set('onRequest', 'dummy')
    done()
  })

  app.addHook('preParsing', (req, reply, payload, done) => {
    req.requestContext.set('preParsing', 'dummy')
    done(null, payload)
  })

  app.addHook('preValidation', (req, reply, done) => {
    const requestId = Number.parseInt(req.body.requestId)
    req.requestContext.set('preValidation', requestId)
    req.requestContext.set('testKey', `testValue${requestId}`)
    done()
  })

  app.addHook('preHandler', (req, reply, done) => {
    const requestId = Number.parseInt(req.body.requestId)
    req.requestContext.set('preHandler', requestId)
    done()
  })

  app.addHook('preSerialization', (req, reply, payload, done) => {
    const onRequestValue = req.requestContext.get('onRequest')
    const preValidationValue = req.requestContext.get('preValidation')
    done(null, {
      ...payload,
      preSerialization1: onRequestValue,
      preSerialization2: preValidationValue,
    })
  })
  app.route({
    url: '/',
    method: ['GET', 'POST'],
    handler: endpoint,
  })

  return app
}

function initAppGetWithDefaultStoreValues(endpoint, defaultStoreValues) {
  const app = fastify({ logger: true })
  app.register(fastifyRequestContextPlugin, {
    defaultStoreValues,
  })

  app.get('/', endpoint)
  return app
}

module.exports = {
  initAppPostWithAllPlugins,
  initAppPostWithPrevalidation,
  initAppPost,
  initAppGet,
  initAppGetWithDefaultStoreValues,
}
