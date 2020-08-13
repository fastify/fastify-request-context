const fastify = require('fastify')
const request = require('superagent')
const { fastifyRequestContextPlugin } = require('../lib/requestContextPlugin')
const { TestService } = require('./internal/testService')

function initAppPostWithPrevalidation(endpoint) {
  return new Promise((resolve) => {
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

    app.listen(8085, '0.0.0.0', (err, address) => {
      if (err) {
        console.warn(err)
        process.exit(1)
      }
      console.info(`Server listening at ${address}`)
      resolve(app)
    })
  })
}

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

          initAppPostWithPrevalidation(route).then((_app) => {
            app = _app
            testService = new TestService(app)
            const response1Promise = request('POST', '0.0.0.0:8085')
              .send({ requestId: 1 })
              .then((response) => {
                expect(response.body.storedValue).toBe('testValue1')
                responseCounter++
                if (responseCounter === 2) {
                  resolveResponsePromise()
                }
              })

            const response2Promise = request('POST', '0.0.0.0:8085')
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
