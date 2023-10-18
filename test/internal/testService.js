'use strict'

const { requestContext } = require('../..')

// Test class to check if nested calls with promises work correctly with async local storage
class TestService {
  constructor(fastify) {
    this.appRequestContext = fastify.requestContext
  }

  processRequest(requestId) {
    return this.fetchData().then(() => {
      const testValueFromApp = this.appRequestContext.get('testKey')
      const testValueFromLib = requestContext.get('testKey')
      if (testValueFromApp !== `testValue${requestId}`) {
        throw new Error(
          `Wrong value retrieved from app context for request ${requestId}: ${testValueFromApp}`,
        )
      }

      if (testValueFromLib !== `testValue${requestId}`) {
        throw new Error(
          `Wrong value retrieved from lib context for request ${requestId}: ${testValueFromLib}`,
        )
      }
    })
  }

  fetchData() {
    return new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
  }
}

module.exports = {
  TestService,
}
