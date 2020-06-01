export type RequestContext = {
  get: <T>(key: string) => T | undefined
  set: <T>(key: string, value: T) => void
}

export type RequestContextOptions = {
  defaultStoreValues?: Record<string, any>
}

declare module 'fastify' {
  export interface FastifyRequest<HttpRequest, Query, Params, Headers, Body> {
    requestContext: RequestContext
  }

  export interface FastifyInstance<HttpServer, HttpRequest, HttpResponse> {
    requestContext: RequestContext
  }
}
