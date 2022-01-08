import { FastifyPlugin } from 'fastify'

export interface RequestContextData {
  [key: string]: any
}

export interface RequestContext {
  get<K extends keyof RequestContextData>(key: K): RequestContextData[K] | undefined
  set<K extends keyof RequestContextData>(key: K, value: RequestContextData[K]): void
}

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

export interface RequestContextOptions {
  defaultStoreValues?: RequestContextData
  hook?: Hook
}

declare module 'fastify' {
  interface FastifyRequest {
    requestContext: RequestContext
  }

  interface FastifyInstance {
    requestContext: RequestContext
  }
}

declare const fastifyRequestContextPlugin: FastifyPlugin<RequestContextOptions>
declare const requestContext: RequestContext

export { fastifyRequestContextPlugin, requestContext }
