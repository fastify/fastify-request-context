import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks'
import { FastifyPluginCallback, FastifyRequest } from 'fastify'

type FastifyRequestContext =
  FastifyPluginCallback<fastifyRequestContext.FastifyRequestContextOptions>

declare module 'fastify' {
  interface FastifyRequest {
    requestContext: fastifyRequestContext.RequestContext
  }

  interface FastifyInstance {
    requestContext: fastifyRequestContext.RequestContext
  }
}

declare namespace fastifyRequestContext {
  export interface RequestContextData {
    // Empty on purpose, to be extended by users of this module
  }

  export interface RequestContext {
    get<K extends keyof RequestContextData>(key: K): RequestContextData[K] | undefined
    set<K extends keyof RequestContextData>(key: K, value: RequestContextData[K]): void
    transform<K extends keyof RequestContextData>(
      key: K,
      fn: (oldValue: RequestContextData[K]) => RequestContextData[K],
    ): void
    getStore(): RequestContextData | undefined
  }

  export type CreateAsyncResourceFactory<T extends AsyncResource = AsyncResource> = (
    req: FastifyRequest,
    context: RequestContext,
  ) => T

  export type RequestContextDataFactory = (req: FastifyRequest) => RequestContextData

  export type Hook =
    | 'onRequest'
    | 'preParsing'
    | 'preValidation'
    | 'preHandler'
    | 'preSerialization'
    | 'onSend'
    | 'onResponse'
    | 'onTimeout'
    | 'onError'
    | 'onRoute'
    | 'onRegister'
    | 'onReady'
    | 'onClose'

  export interface FastifyRequestContextOptions {
    defaultStoreValues?: RequestContextData | RequestContextDataFactory
    hook?: Hook
    createAsyncResource?: CreateAsyncResourceFactory
  }

  export const requestContext: RequestContext
  export const asyncLocalStorage: AsyncLocalStorage<RequestContext>
  /**
   * @deprecated Use FastifyRequestContextOptions instead
   */
  export type RequestContextOptions = FastifyRequestContextOptions

  /**
   * @deprecated Use fastifyRequestContext instead
   */
  export const fastifyRequestContextPlugin: FastifyRequestContext

  export const fastifyRequestContext: FastifyRequestContext
  export { fastifyRequestContext as default }
}

declare function fastifyRequestContext(
  ...params: Parameters<FastifyRequestContext>
): ReturnType<FastifyRequestContext>
export = fastifyRequestContext
