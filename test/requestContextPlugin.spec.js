'use strict'

const {
  initAppPost,
  initAppPostWithPrevalidation,
  initAppGet,
  initAppGetWithDefaultStoreValues,
} = require('./internal/appInitializer')
const { TestService } = require('./internal/testService')

describe('requestContextPlugin', () => {
  let app
  afterEach(() => {
    return app.close()
  })

  it('correctly preserves values within single GET request', () => {
    expect.assertions(2)

    let testService
    let responseCounter = 0
    return new Promise((resolveResponsePromise) => {
      const promiseRequest2 = new Promise((resolveRequest2Promise) => {
        const promiseRequest1 = new Promise((resolveRequest1Promise) => {
          const route = (req, reply) => {
            function prepareReply() {
              return testService.processRequest(requestId).then(() => {
                const storedValue = req.requestContext.get('testKey')
                reply.status(200).send({
                  storedValue,
                })
              })
            }

            const requestId = Number.parseInt(req.query.requestId)
            req.requestContext.set('testKey', `testValue${requestId}`)

            // We don't want to read values until both requests wrote their values to see if there is a racing condition
            if (requestId === 1) {
              resolveRequest1Promise()
              return promiseRequest2.then(prepareReply)
            }

            if (requestId === 2) {
              resolveRequest2Promise()
              return promiseRequest1.then(prepareReply)
            }
          }

          initAppGet(route)
            .ready()
            .then((_app) => {
              app = _app
              testService = new TestService(app)
              const response1Promise = app
                .inject()
                .get('/')
                .query({ requestId: 1 })
                .end()
                .then((response) => {
                  expect(response.json().storedValue).toBe('testValue1')
                  responseCounter++
                  if (responseCounter === 2) {
                    resolveResponsePromise()
                  }
                })

              const response2Promise = app
                .inject()
                .get('/')
                .query({ requestId: 2 })
                .end()
                .then((response) => {
                  expect(response.json().storedValue).toBe('testValue2')
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

  it('correctly preserves values within single POST request', () => {
    expect.assertions(2)

    let testService
    let responseCounter = 0
    return new Promise((resolveResponsePromise) => {
      const promiseRequest2 = new Promise((resolveRequest2Promise) => {
        const promiseRequest1 = new Promise((resolveRequest1Promise) => {
          const route = (req, reply) => {
            function prepareReply() {
              return testService.processRequest(requestId).then(() => {
                const storedValue = req.requestContext.get('testKey')
                reply.status(200).send({
                  storedValue,
                })
              })
            }

            const requestId = Number.parseInt(req.body.requestId)
            req.requestContext.set('testKey', `testValue${requestId}`)

            // We don't want to read values until both requests wrote their values to see if there is a racing condition
            if (requestId === 1) {
              resolveRequest1Promise()
              return promiseRequest2.then(prepareReply)
            }

            if (requestId === 2) {
              resolveRequest2Promise()
              return promiseRequest1.then(prepareReply)
            }
          }

          initAppPost(route)
            .ready()
            .then((_app) => {
              app = _app
              testService = new TestService(app)
              const response1Promise = app
                .inject()
                .post('/')
                .body({ requestId: 1 })
                .end()
                .then((response) => {
                  expect(response.json().storedValue).toBe('testValue1')
                  responseCounter++
                  if (responseCounter === 2) {
                    resolveResponsePromise()
                  }
                })

              const response2Promise = app
                .inject()
                .post('/')
                .body({ requestId: 2 })
                .end()
                .then((response) => {
                  expect(response.json().storedValue).toBe('testValue2')
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

  it('correctly preserves values set in prevalidation phase within single POST request', () => {
    expect.assertions(2)

    let testService
    let responseCounter = 0
    return new Promise((resolveResponsePromise) => {
      const promiseRequest2 = new Promise((resolveRequest2Promise) => {
        const promiseRequest1 = new Promise((resolveRequest1Promise) => {
          const route = (req, reply) => {
            const requestId = req.requestContext.get('testKey')

            function prepareReply() {
              return testService.processRequest(requestId.replace('testValue', '')).then(() => {
                const storedValue = req.requestContext.get('testKey')
                reply.status(200).send({
                  storedValue,
                })
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
          }

          initAppPostWithPrevalidation(route)
            .ready()
            .then((_app) => {
              app = _app
              testService = new TestService(app)
              const response1Promise = app
                .inject()
                .post('/')
                .body({ requestId: 1 })
                .end()
                .then((response) => {
                  expect(response.json().storedValue).toBe('testValue1')
                  responseCounter++
                  if (responseCounter === 2) {
                    resolveResponsePromise()
                  }
                })

              const response2Promise = app
                .inject()
                .post('/')
                .body({ requestId: 2 })
                .end()
                .then((response) => {
                  expect(response.json().storedValue).toBe('testValue2')
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

  it('does not affect new request context when mutating context data using default values factory', () => {
    expect.assertions(2)

    const route = (req, reply) => {
      const { action } = req.query
      if (action === 'setvalue') {
        req.requestContext.get('user').id = 'bob'
      }

      reply.status(200).send(req.requestContext.get('user').id)
    }

    return new Promise((resolve) => {
      initAppGetWithDefaultStoreValues(route, () => ({
        user: { id: 'system' },
      }))
        .ready()
        .then((app) => {
          const response1 = app
            .inject()
            .get('/')
            .query({ action: 'setvalue' })
            .end()
            .then((response) => {
              expect(response.body).toBe('bob')
            })

          response1.then(() => {
            app
              .inject()
              .get('/')
              .end()
              .then((response) => {
                expect(response.body).toBe('system')
                resolve()
              })
          })
        })
    })
  })

  it('correctly preserves values for 204 responses', () => {
    expect.assertions(2)

    let testService
    let responseCounter = 0
    return new Promise((resolveResponsePromise) => {
      const promiseRequest2 = new Promise((resolveRequest2Promise) => {
        const promiseRequest1 = new Promise((resolveRequest1Promise) => {
          const route = (req, reply) => {
            function prepareReply() {
              return testService.processRequest(requestId).then(() => {
                const storedValue = req.requestContext.get('testKey')
                reply.status(204).header('storedvalue', storedValue).send()
              })
            }

            const requestId = Number.parseInt(req.query.requestId)
            req.requestContext.set('testKey', `testValue${requestId}`)

            // We don't want to read values until both requests wrote their values to see if there is a racing condition
            if (requestId === 1) {
              resolveRequest1Promise()
              return promiseRequest2.then(prepareReply)
            }

            if (requestId === 2) {
              resolveRequest2Promise()
              return promiseRequest1.then(prepareReply)
            }
          }

          initAppGet(route)
            .ready()
            .then((_app) => {
              app = _app
              testService = new TestService(app)
              const response1Promise = app
                .inject()
                .get('/')
                .query({ requestId: 1 })
                .end()
                .then((response) => {
                  expect(response.headers.storedvalue).toBe('testValue1')
                  responseCounter++
                  if (responseCounter === 2) {
                    resolveResponsePromise()
                  }
                })

              const response2Promise = app
                .inject()
                .get('/')
                .query({ requestId: 2 })
                .end()
                .then((response) => {
                  expect(response.headers.storedvalue).toBe('testValue2')
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
})
