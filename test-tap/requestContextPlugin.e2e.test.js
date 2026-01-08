'use strict'

const fastify = require('fastify')
const request = require('superagent')
const {
  initAppPostWithPrevalidation,
  initAppPostWithAllPlugins,
  initAppGetWithDefaultStoreValues,
} = require('../test/internal/appInitializer')
const { fastifyRequestContext } = require('..')
const { TestService } = require('../test/internal/testService')
const { test, afterEach } = require('node:test')
const { CustomResource, AsyncHookContainer } = require('../test/internal/watcherService')
const { executionAsyncId } = require('node:async_hooks')

let app
afterEach(() => {
  return app.close()
})

test('correctly preserves values set in prevalidation phase within single POST request', (t) => {
  t.plan(2)

  let testService
  let responseCounter = 0
  return new Promise((resolveResponsePromise) => {
    const promiseRequest2 = new Promise((resolveRequest2Promise) => {
      const promiseRequest1 = new Promise((resolveRequest1Promise) => {
        const route = (req) => {
          const requestId = req.requestContext.get('testKey')

          function prepareReply() {
            return testService.processRequest(requestId.replace('testValue', '')).then(() => {
              const storedValue = req.requestContext.get('testKey')
              return Promise.resolve({ storedValue })
            })
          }

          // We don't want to read values until both requests wrote their values to see if there is a racing condition
          if (requestId === 'testValue1') {
            resolveRequest1Promise()
            return promiseRequest2.then(prepareReply)
          }

          if (requestId === 'testValue2') {
            resolveRequest2Promise()
            return promiseRequest1.then(prepareReply)
          }

          throw new Error(`Unexpected requestId: ${requestId}`)
        }

        app = initAppPostWithPrevalidation(route)
        app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
          testService = new TestService(app)
          const { address, port } = app.server.address()
          const url = `http://${address}:${port}`
          const response1Promise = request('POST', url)
            .send({ requestId: 1 })
            .then((response) => {
              t.assert.strictEqual(response.body.storedValue, 'testValue1')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          const response2Promise = request('POST', url)
            .send({ requestId: 2 })
            .then((response) => {
              t.assert.strictEqual(response.body.storedValue, 'testValue2')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          return Promise.all([response1Promise, response2Promise])
        })
      })

      return promiseRequest1
    })

    return promiseRequest2
  })
})

test('correctly preserves values set in multiple phases within single POST request', (t) => {
  t.plan(10)

  let testService
  let responseCounter = 0
  return new Promise((resolveResponsePromise) => {
    const promiseRequest2 = new Promise((resolveRequest2Promise) => {
      const promiseRequest1 = new Promise((resolveRequest1Promise) => {
        const route = (req) => {
          const onRequestValue = req.requestContext.get('onRequest')
          const preParsingValue = req.requestContext.get('preParsing')
          const preValidationValue = req.requestContext.get('preValidation')
          const preHandlerValue = req.requestContext.get('preHandler')

          t.assert.strictEqual(onRequestValue, undefined)
          t.assert.strictEqual(preParsingValue, undefined)
          t.assert.ok(typeof preValidationValue === 'number')
          t.assert.ok(typeof preHandlerValue === 'number')

          const requestId = `testValue${preHandlerValue}`

          function prepareReply() {
            return testService.processRequest(requestId.replace('testValue', '')).then(() => {
              const storedValue = req.requestContext.get('preValidation')
              return Promise.resolve({ storedValue: `testValue${storedValue}` })
            })
          }

          // We don't want to read values until both requests wrote their values to see if there is a racing condition
          if (requestId === 'testValue1') {
            resolveRequest1Promise()
            return promiseRequest2.then(prepareReply)
          }

          if (requestId === 'testValue2') {
            resolveRequest2Promise()
            return promiseRequest1.then(prepareReply)
          }

          throw new Error(`Unexpected requestId: ${requestId}`)
        }

        app = initAppPostWithAllPlugins(route, 'preValidation')

        app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
          testService = new TestService(app)
          const { address, port } = app.server.address()
          const url = `http://${address}:${port}`
          const response1Promise = request('POST', url)
            .send({ requestId: 1 })
            .then((response) => {
              t.assert.strictEqual(response.body.storedValue, 'testValue1')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          const response2Promise = request('POST', url)
            .send({ requestId: 2 })
            .then((response) => {
              t.assert.strictEqual(response.body.storedValue, 'testValue2')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          return Promise.all([response1Promise, response2Promise])
        })
      })

      return promiseRequest1
    })

    return promiseRequest2
  })
})

test('correctly preserves values set in multiple phases within single POST request', (t) => {
  t.plan(7)

  const route = (req) => {
    const onRequestValue = req.requestContext.get('onRequest')
    const preParsingValue = req.requestContext.get('preParsing')
    const preValidationValue = req.requestContext.get('preValidation')
    const preHandlerValue = req.requestContext.get('preHandler')

    t.assert.strictEqual(onRequestValue, 'dummy')
    t.assert.strictEqual(preParsingValue, 'dummy')
    t.assert.ok(typeof preValidationValue === 'number')
    t.assert.ok(typeof preHandlerValue === 'number')

    const requestId = `testValue${preHandlerValue}`
    return Promise.resolve({ storedValue: requestId })
  }

  app = initAppPostWithAllPlugins(route)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `http://${address}:${port}`
    return request('POST', url)
      .send({ requestId: 1 })
      .then((response) => {
        t.assert.strictEqual(response.body.storedValue, 'testValue1')
        t.assert.strictEqual(response.body.preSerialization1, 'dummy')
        t.assert.strictEqual(response.body.preSerialization2, 1)
      })
  })
})

test('does not affect new request context when mutating context data using no default values object', (t) => {
  t.plan(2)

  const route = (req) => {
    const { action } = req.query
    if (action === 'setvalue') {
      req.requestContext.set('foo', 'abc')
    }

    return Promise.resolve({ userId: req.requestContext.get('foo') })
  }

  app = initAppGetWithDefaultStoreValues(route, undefined)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    return request('GET', url)
      .query({ action: 'setvalue' })
      .then((response1) => {
        t.assert.strictEqual(response1.body.userId, 'abc')

        return request('GET', url).then((response2) => {
          t.assert.ok(!response2.body.userId)
        })
      })
  })
})

test('does not affect new request context when mutating context data using default values object', (t) => {
  t.plan(2)

  const route = (req) => {
    const { action } = req.query
    if (action === 'setvalue') {
      req.requestContext.set('foo', 'abc')
    }

    return Promise.resolve({ userId: req.requestContext.get('foo') })
  }

  app = initAppGetWithDefaultStoreValues(route, {
    foo: 'bar',
  })

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    return request('GET', url)
      .query({ action: 'setvalue' })
      .then((response1) => {
        t.assert.strictEqual(response1.body.userId, 'abc')

        return request('GET', url).then((response2) => {
          t.assert.strictEqual(response2.body.userId, 'bar')
        })
      })
  })
})

test('does not affect new request context when mutating context data using default values factory', (t) => {
  t.plan(2)

  const route = (req) => {
    const { action } = req.query
    if (action === 'setvalue') {
      req.requestContext.get('user').id = 'bob'
    }

    return Promise.resolve({ userId: req.requestContext.get('user').id })
  }

  app = initAppGetWithDefaultStoreValues(route, () => ({
    user: { id: 'system' },
  }))

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    return request('GET', url)
      .query({ action: 'setvalue' })
      .then((response1) => {
        t.assert.strictEqual(response1.body.userId, 'bob')

        return request('GET', url).then((response2) => {
          t.assert.strictEqual(response2.body.userId, 'system')
        })
      })
  })
})

test('ensure request instance is properly exposed to default values factory', (t) => {
  t.plan(1)

  const route = (req) => {
    return Promise.resolve({ userId: req.requestContext.get('user').id })
  }

  app = initAppGetWithDefaultStoreValues(route, (req) => ({
    user: { id: req.protocol },
  }))

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    return request('GET', url).then((response1) => {
      t.assert.strictEqual(response1.body.userId, 'http')
    })
  })
})

test('does not throw when accessing context object outside of context', (t) => {
  t.plan(2)

  const route = (req) => {
    return Promise.resolve({ userId: req.requestContext.get('user').id })
  }

  app = initAppGetWithDefaultStoreValues(route, {
    user: { id: 'system' },
  })

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    t.assert.strictEqual(app.requestContext.get('user'), undefined)

    return request('GET', url).then((response1) => {
      t.assert.strictEqual(response1.body.userId, 'system')
    })
  })
})

test('passing a custom resource factory function when create as AsyncResource', (t) => {
  t.plan(2)

  const container = new AsyncHookContainer(['fastify-request-context', 'custom-resource-type'])

  app = fastify({ logger: true })
  app.register(fastifyRequestContext, {
    defaultStoreValues: { user: { id: 'system' } },
    createAsyncResource: () => {
      return new CustomResource('custom-resource-type', '1111-2222-3333')
    },
  })

  const route = (req) => {
    const store = container.getStore(executionAsyncId())
    t.assert.strictEqual(store.traceId, '1111-2222-3333')
    return Promise.resolve({ userId: req.requestContext.get('user').id })
  }

  app.get('/', route)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    return request('GET', url).then((response1) => {
      t.assert.strictEqual(response1.body.userId, 'system')
    })
  })
})

test('transform method correctly updates context values using transformation function', (t) => {
  t.plan(1)

  const route = (req) => {
    // Set initial value
    req.requestContext.set('counter', 5)

    // Use transform to increment the value
    req.requestContext.transform('counter', (oldValue) => oldValue + 3)

    const finalValue = req.requestContext.get('counter')
    return Promise.resolve({ value: finalValue })
  }

  app = initAppGetWithDefaultStoreValues(route, undefined)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `http://${address}:${port}`

    return request('GET', url).then((response) => {
      t.assert.strictEqual(response.body.value, 8)
    })
  })
})

test('transform method works with objects and complex data structures', (t) => {
  t.plan(2)

  const route = (req) => {
    req.requestContext.set('user', { id: 'system', permissions: ['read'] })

    // Add a new permission using transform
    req.requestContext.transform('user', (oldUser) => ({
      ...oldUser,
      permissions: [...oldUser.permissions, 'write'],
    }))

    const user = req.requestContext.get('user')
    return Promise.resolve({
      id: user.id,
      permissions: user.permissions,
    })
  }

  app = initAppGetWithDefaultStoreValues(route, undefined)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `http://${address}:${port}`

    return request('GET', url).then((response) => {
      t.assert.strictEqual(response.body.id, 'system')
      t.assert.deepStrictEqual(response.body.permissions, ['read', 'write'])
    })
  })
})

test('transform method preserves values within single request without affecting others', (t) => {
  t.plan(2)

  const route = (req) => {
    const { action } = req.query

    if (action === 'increment') {
      req.requestContext.transform('counter', (oldValue = 0) => oldValue + 1)
    }

    return Promise.resolve({ count: req.requestContext.get('counter') })
  }

  app = initAppGetWithDefaultStoreValues(route, undefined)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `http://${address}:${port}`

    // First request with increment
    return request('GET', url)
      .query({ action: 'increment' })
      .then((response1) => {
        t.assert.strictEqual(response1.body.count, 1)

        // Second request without increment should not see first request's value
        return request('GET', url).then((response2) => {
          t.assert.ok(!response2.body.count)
        })
      })
  })
})

test('transform method works with default store values', (t) => {
  t.plan(2)

  const route = (req) => {
    // Transform the default value
    req.requestContext.transform('user', (oldUser) => ({
      ...oldUser,
      status: 'active',
    }))

    const user = req.requestContext.get('user')
    return Promise.resolve({
      id: user.id,
      status: user.status,
    })
  }

  app = initAppGetWithDefaultStoreValues(route, {
    user: { id: 'system', status: 'inactive' },
  })

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `http://${address}:${port}`

    return request('GET', url).then((response) => {
      t.assert.strictEqual(response.body.id, 'system')
      t.assert.strictEqual(response.body.status, 'active')
    })
  })
})

test('returns the store', (t) => {
  t.plan(2)

  app = fastify({ logger: true })
  app.register(fastifyRequestContext, {
    defaultStoreValues: { foo: 42 },
  })

  const route = (req) => {
    const store = req.requestContext.getStore()
    t.assert.strictEqual(store.foo, 42)
    return store.foo
  }

  app.get('/', route)

  return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`

    return request('GET', url).then((response1) => {
      t.assert.strictEqual(response1.body, 42)
    })
  })
})
