const request = require('superagent')
const {
  initAppPostWithPrevalidation,
  initAppPostWithAllPlugins,
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
          app.listen(0).then(() => {
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

            expect(onRequestValue).toBe(undefined)
            expect(preParsingValue).toBe(undefined)
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

          app.listen(0).then(() => {
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
})
