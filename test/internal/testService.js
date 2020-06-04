// Test class to check if nested calls with promises work correctly with async local storage
class TestService {
  constructor(fastify) {
    this.requestContext = fastify.requestContext
  }

  processRequest(requestId) {
    return this.fetchData().then(() => {
      const testValue = this.requestContext.get('testKey')
      if (testValue !== `testValue${requestId}`) {
        throw new Error(`Wrong value retrieved for request ${requestId}: ${testValue}`)
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
