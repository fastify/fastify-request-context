// Test class to check if nested calls with promises work correctly with async local storage
class TestService {
  constructor(fastify) {
    this.requestContext = fastify.requestContext
  }

  async processRequest(requestId) {
    await this.fetchData()
    const testValue = this.requestContext.get('testKey')
    if (testValue !== `testValue${requestId}`) {
      throw new Error(`Wrong value retrieved for request ${requestId}: ${testValue}`)
    }
  }

  async fetchData() {
    const promise = new Promise((resolve) => {
      setTimeout(resolve, 10)
    })

    await promise
  }
}

module.exports = {
  TestService,
}
