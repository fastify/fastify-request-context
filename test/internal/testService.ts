import type { FastifyInstance } from 'fastify'
import type { RequestContext } from '../../lib/requestContextPlugin'

// Test class to check if nested calls with promises work correctly with async local storage
export class TestService {
  private requestContext: RequestContext

  constructor(fastify: FastifyInstance) {
    this.requestContext = fastify.requestContext
  }

  async processRequest(requestId: number): Promise<void> {
    await this.fetchData()
    const testValue = this.requestContext.get('testKey')
    if (testValue !== `testValue${requestId}`) {
      throw new Error(`Wrong value retrieved for request ${requestId}: ${testValue}`)
    }
  }

  async fetchData(): Promise<void> {
    const promise = new Promise((resolve) => {
      setTimeout(resolve, 10)
    })

    await promise
  }
}
