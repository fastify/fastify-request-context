'use strict'

const { executionAsyncId, createHook, AsyncResource } = require('node:async_hooks')
const { EventEmitter } = require('node:events')

class CustomResource extends AsyncResource {
  constructor(type, traceId) {
    super(type)

    this.traceId = traceId
  }
}

class AsyncWatcher extends EventEmitter {
  setupInitHook() {
    // init is called during object construction. The resource may not have
    // completed construction when this callback runs, therefore all fields of the
    // resource referenced by "asyncId" may not have been populated.
    this.init = (asyncId, type, triggerAsyncId, resource) => {
      this.emit('INIT', {
        asyncId,
        type,
        triggerAsyncId,
        executionAsyncId: executionAsyncId(),
        resource,
      })
    }
    return this
  }

  setupDestroyHook() {
    // Destroy is called when an AsyncWrap instance is destroyed.
    this.destroy = (asyncId) => {
      this.emit('DESTROY', {
        asyncId,
        executionAsyncId: executionAsyncId(),
      })
    }
    return this
  }

  start() {
    createHook({
      init: this.init.bind(this),
      destroy: this.destroy.bind(this),
    }).enable()

    return this
  }
}

class AsyncHookContainer {
  constructor(types) {
    const checkedTypes = types

    const idMap = new Map()
    const resourceMap = new Map()
    const watcher = new AsyncWatcher()
    const check = (t) => {
      try {
        return checkedTypes.includes(t)
      } catch {
        return false
      }
    }

    watcher
      .setupInitHook()
      .setupDestroyHook()
      .start()
      .on('INIT', ({ asyncId, type, resource, triggerAsyncId }) => {
        idMap.set(asyncId, triggerAsyncId)

        if (check(type)) {
          resourceMap.set(asyncId, resource)
        }
      })
      .on('DESTROY', ({ asyncId }) => {
        idMap.delete(asyncId)
        resourceMap.delete(asyncId)
      })

    this.types = checkedTypes
    this.idMap = idMap
    this.resourceMap = resourceMap
    this.watcher = watcher
  }

  getStore(asyncId) {
    let resource = this.resourceMap.get(asyncId)

    if (resource != null) {
      return resource
    }

    let id = this.idMap.get(asyncId)
    let sentinel = 0

    while (id != null && sentinel < 100) {
      resource = this.resourceMap.get(id)

      if (resource != null) {
        return resource
      }

      id = this.idMap.get(id)
      sentinel += 1
    }

    return undefined
  }
}

module.exports = {
  AsyncWatcher,
  AsyncHookContainer,
  CustomResource,
}
