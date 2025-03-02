'use strict'

const request = require('superagent')
const { describe, afterEach, test } = require('node:test')
const {
  initAppPostWithPrevalidation,
  initAppPostWithAllPlugins,
  initAppGetWithDefaultStoreValues,
} = require('./internal/appInitializer')
const { TestService } = require('./internal/testService')

describe('requestContextPlugin E2E', () => {
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
            const url = `${address}:${port}`
            const response1Promise = request('POST', url)
              .send({ requestId: 1 })
              .then((response) => {
                t.assert.deepStrictEqual(response.body.storedValue, 'testValue1')
                responseCounter++
                if (responseCounter === 2) {
                  resolveResponsePromise()
                }
              })

            const response2Promise = request('POST', url)
              .send({ requestId: 2 })
              .then((response) => {
                t.assert.deepStrictEqual(response.body.storedValue, 'testValue2')
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

            t.assert.ok(!onRequestValue)
            t.assert.ok(!preParsingValue)
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
            const url = `${address}:${port}`
            const response1Promise = request('POST', url)
              .send({ requestId: 1 })
              .then((response) => {
                t.assert.deepStrictEqual(response.body.storedValue, 'testValue1')
                responseCounter++
                if (responseCounter === 2) {
                  resolveResponsePromise()
                }
              })

            const response2Promise = request('POST', url)
              .send({ requestId: 2 })
              .then((response) => {
                t.assert.deepStrictEqual(response.body.storedValue, 'testValue2')
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

  test('does not lose request context after body parsing', (t) => {
    t.plan(7)
    const route = (req) => {
      const onRequestValue = req.requestContext.get('onRequest')
      const preParsingValue = req.requestContext.get('preParsing')
      const preValidationValue = req.requestContext.get('preValidation')
      const preHandlerValue = req.requestContext.get('preHandler')

      t.assert.deepStrictEqual(onRequestValue, 'dummy')
      t.assert.deepStrictEqual(preParsingValue, 'dummy')
      t.assert.ok(typeof preValidationValue === 'number')
      t.assert.ok(typeof preHandlerValue === 'number')

      const requestId = `testValue${preHandlerValue}`
      return Promise.resolve({ storedValue: requestId })
    }

    app = initAppPostWithAllPlugins(route, 'onRequest')

    return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
      const { address, port } = app.server.address()
      const url = `${address}:${port}`
      return request('POST', url)
        .send({ requestId: 1 })
        .then((response) => {
          t.assert.deepStrictEqual(response.body.storedValue, 'testValue1')
          t.assert.deepStrictEqual(response.body.preSerialization1, 'dummy')
          t.assert.deepStrictEqual(response.body.preSerialization2, 1)
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
          t.assert.deepStrictEqual(response1.body.userId, 'abc')

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
          t.assert.deepStrictEqual(response1.body.userId, 'abc')

          return request('GET', url).then((response2) => {
            t.assert.deepStrictEqual(response2.body.userId, 'bar')
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
          t.assert.deepStrictEqual(response1.body.userId, 'bob')

          return request('GET', url).then((response2) => {
            t.assert.deepStrictEqual(response2.body.userId, 'system')
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
        t.assert.deepStrictEqual(response1.body.userId, 'http')
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

      t.assert.ok(!app.requestContext.get('user'))

      return request('GET', url).then((response1) => {
        t.assert.deepStrictEqual(response1.body.userId, 'system')
      })
    })
  })
})
