'use strict'

const request = require('superagent')
const {
  initAppPostWithPrevalidation,
  initAppPostWithAllPlugins,
} = require('../test/internal/appInitializer')
const { TestService } = require('../test/internal/testService')
const t = require('tap')
const test = t.test

let app
t.afterEach(() => {
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
        app.listen(0).then(() => {
          testService = new TestService(app)
          const { address, port } = app.server.address()
          const url = `${address}:${port}`
          const response1Promise = request('POST', url)
            .send({ requestId: 1 })
            .then((response) => {
              t.equal(response.body.storedValue, 'testValue1')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          const response2Promise = request('POST', url)
            .send({ requestId: 2 })
            .then((response) => {
              t.equal(response.body.storedValue, 'testValue2')
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

          t.equal(onRequestValue, undefined)
          t.equal(preParsingValue, undefined)
          t.type(preValidationValue, 'number')
          t.type(preHandlerValue, 'number')

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

        app.listen(0).then(() => {
          testService = new TestService(app)
          const { address, port } = app.server.address()
          const url = `${address}:${port}`
          const response1Promise = request('POST', url)
            .send({ requestId: 1 })
            .then((response) => {
              t.equal(response.body.storedValue, 'testValue1')
              responseCounter++
              if (responseCounter === 2) {
                resolveResponsePromise()
              }
            })

          const response2Promise = request('POST', url)
            .send({ requestId: 2 })
            .then((response) => {
              t.equal(response.body.storedValue, 'testValue2')
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

    t.equal(onRequestValue, 'dummy')
    t.equal(preParsingValue, 'dummy')
    t.type(preValidationValue, 'number')
    t.type(preHandlerValue, 'number')

    const requestId = `testValue${preHandlerValue}`
    return Promise.resolve({ storedValue: requestId })
  }

  app = initAppPostWithAllPlugins(route)

  return app.listen(0).then(() => {
    const { address, port } = app.server.address()
    const url = `${address}:${port}`
    return request('POST', url)
      .send({ requestId: 1 })
      .then((response) => {
        t.equal(response.body.storedValue, 'testValue1')
        t.equal(response.body.preSerialization1, 'dummy')
        t.equal(response.body.preSerialization2, 1)
      })
  })
})
