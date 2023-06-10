'use strict'

const request = require('superagent')
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

  it('correctly preserves values set in prevalidation phase within single POST request', () => {
    expect.assertions(2)

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
                expect(response.body.storedValue).toBe('testValue1')
                responseCounter++
                if (responseCounter === 2) {
                  resolveResponsePromise()
                }
              })

            const response2Promise = request('POST', url)
              .send({ requestId: 2 })
              .then((response) => {
                expect(response.body.storedValue).toBe('testValue2')
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

  it('correctly preserves values set in multiple phases within single POST request', () => {
    expect.assertions(10)

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

            expect(onRequestValue).toBeUndefined()
            expect(preParsingValue).toBeUndefined()
            expect(preValidationValue).toEqual(expect.any(Number))
            expect(preHandlerValue).toEqual(expect.any(Number))

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
                expect(response.body.storedValue).toBe('testValue1')
                responseCounter++
                if (responseCounter === 2) {
                  resolveResponsePromise()
                }
              })

            const response2Promise = request('POST', url)
              .send({ requestId: 2 })
              .then((response) => {
                expect(response.body.storedValue).toBe('testValue2')
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

  it('does not lose request context after body parsing', () => {
    expect.assertions(7)
    const route = (req) => {
      const onRequestValue = req.requestContext.get('onRequest')
      const preParsingValue = req.requestContext.get('preParsing')
      const preValidationValue = req.requestContext.get('preValidation')
      const preHandlerValue = req.requestContext.get('preHandler')

      expect(onRequestValue).toBe('dummy')
      expect(preParsingValue).toBe('dummy')
      expect(preValidationValue).toEqual(expect.any(Number))
      expect(preHandlerValue).toEqual(expect.any(Number))

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
          expect(response.body.storedValue).toBe('testValue1')
          expect(response.body.preSerialization1).toBe('dummy')
          expect(response.body.preSerialization2).toBe(1)
        })
    })
  })

  it('does not affect new request context when mutating context data using default values factory', () => {
    expect.assertions(2)

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
          expect(response1.body.userId).toBe('bob')

          return request('GET', url).then((response2) => {
            expect(response2.body.userId).toBe('system')
          })
        })
    })
  })

  test('ensure request instance is properly exposed to default values factory', () => {
    expect.assertions(1)

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
        expect(response1.body.userId).toBe('http')
      })
    })
  })

  test('does not throw when accessing context object outside of context', () => {
    expect.assertions(2)

    const route = (req) => {
      return Promise.resolve({ userId: req.requestContext.get('user').id })
    }

    app = initAppGetWithDefaultStoreValues(route, {
      user: { id: 'system' },
    })

    return app.listen({ port: 0, host: '127.0.0.1' }).then(() => {
      const { address, port } = app.server.address()
      const url = `${address}:${port}`

      expect(app.requestContext.get('user')).toBe(undefined)

      return request('GET', url).then((response1) => {
        expect(response1.body.userId).toBe('system')
      })
    })
  })
})
