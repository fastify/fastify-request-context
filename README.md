# fastify-request-context

[![NPM Version][npm-image]][npm-url]
[![Build Status](https://github.com/fastify/fastify-request-context/workflows/ci/badge.svg)](https://github.com/fastify/fastify-request-context/actions)

Request-scoped storage support, based on [Asynchronous Local Storage](https://github.com/kibertoad/asynchronous-local-storage) (which uses native Node.js ALS with fallback to [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked) for older Node.js versions)

Inspired by work done in [fastify-http-context](https://github.com/thorough-developer/fastify-http-context).

This plugin introduces thread-local request-scoped http context, where any variables set within the scope of a single http call won't be overwritten by simultaneous calls to the api
nor will variables remain available once a request is completed.

Frequent use-cases are persisting request-aware logger instances and user authorization information.

## Getting started

First install the package:

```bash
npm i fastify-request-context
```

Next, set up the plugin:

```js
const { fastifyRequestContextPlugin } = require('fastify-request-context')
const fastify = require('fastify');

fastify.register(fastifyRequestContextPlugin, { 
  hook: 'preValidation',
  defaultStoreValues: {
    user: { id: 'system' } 
  }
});
``` 

This plugin accepts options `hook` and `defaultStoreValues`. 

* `hook` allows you to specify to which lifecycle hook should request context initialization be bound. Note that you need to initialize it on the earliest lifecycle stage that you intend to use it in, or earlier. Default value is `onRequest`.
* `defaultStoreValues` sets initial values for the store (that can be later overwritten during request execution if needed). This is an optional parameter.

From there you can set a context in another hook, route, or method that is within scope.

Request context (with methods `get` and `set`) is exposed by library itself, but is also available on `fastify` app instance as well as on `req` request instance.
 
For instance:

```js
const { fastifyRequestContextPlugin, requestContext } = require('fastify-request-context')
const fastify = require('fastify');

const app = fastify({ logger: true })
app.register(fastifyRequestContextPlugin, { 
  defaultStoreValues: {
    user: { id: 'system' } 
  }
});

app.addHook('onRequest', (req, reply, done) => {
  // Overwrite the defaults.
  // This is completely equivalent to using app.requestContext or just requestContext 
  req.requestContext.set('user', { id: 'helloUser' });
  done();
});

// this should now get `helloUser` instead of the default `system`
app.get('/', (req, reply) => {
  // requestContext singleton exposed by the library retains same request-scoped values that were set using `req.requestContext`
  const user = requestContext.get('user');
  reply.code(200).send( { user });
});

app.listen(3000, (err, address) => {
  if (err) throw err
  app.log.info(`server listening on ${address}`)
});

return app.ready()
```

[npm-image]: https://img.shields.io/npm/v/fastify-request-context.svg
[npm-url]: https://npmjs.org/package/fastify-request-context
[downloads-image]: https://img.shields.io/npm/dm/fastify-request-context.svg
[downloads-url]: https://npmjs.org/package/fastify-request-context
