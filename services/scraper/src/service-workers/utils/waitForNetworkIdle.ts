// src/lib/network.ts

import { IgnoreNetworkIdleUrls } from "@/lib/constants"

export interface NetworkIdleOptions {
  tabId: number
  idleTime?: number // How long the network must remain at 0 active requests (in ms)
  timeout?: number // Maximum time to wait before throwing an error (in ms)
  ignoreUrls?: (string | RegExp)[] // Substrings or Regex patterns to skip
}

/**
 * Monitors active network connections and resolves when the network is idle.
 */
export async function waitForNetworkIdle({
  tabId,
  idleTime = 500,
  timeout = 30000,
  ignoreUrls = [],
}: NetworkIdleOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    // We maintain a set of active request IDs to track what is currently loading
    const activeRequests = new Set<string>()
    let idleTimer: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null
    let isResolved = false
    ignoreUrls.push(...IgnoreNetworkIdleUrls)

    // Helper to clean up listeners and timers to prevent memory leaks
    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      chrome.debugger.onEvent.removeListener(onDebuggerEvent)
    }

    // Resolves the promise when our idle condition is successfully met
    const finish = () => {
      if (isResolved) return
      isResolved = true
      cleanup()
      resolve()
    }

    // Rejects the promise if we hit our maximum safety timeout
    const abort = (err: Error) => {
      if (isResolved) return
      isResolved = true
      cleanup()
      reject(err)
    }

    // Evaluates if the network has reached zero active tracked requests
    const checkIdle = () => {
      if (activeRequests.size === 0) {
        if (!idleTimer) {
          idleTimer = setTimeout(finish, idleTime)
        }
      } else {
        if (idleTimer) {
          clearTimeout(idleTimer)
          idleTimer = null
        }
      }
    }

    // Determines whether to skip tracking for a specific URL
    const shouldIgnore = (url: string) => {
      return ignoreUrls.some((pattern) => {
        if (typeof pattern === "string") return url.includes(pattern)
        return pattern.test(url)
      })
    }

    // The core event listener for CDP Network events
    const onDebuggerEvent = (
      source: chrome.debugger.Debuggee,
      method: string,
      params: any
    ) => {
      // Ensure we are only listening to events from our target tab
      if (source.tabId !== tabId) return

      if (method === "Network.requestWillBeSent") {
        const { requestId, request } = params
        if (!shouldIgnore(request.url)) {
          activeRequests.add(requestId)
          checkIdle()
        }
      } else if (
        method === "Network.loadingFinished" ||
        method === "Network.loadingFailed"
      ) {
        const { requestId } = params
        if (activeRequests.has(requestId)) {
          activeRequests.delete(requestId)
          checkIdle() // Check again in case this was the very last pending request
        }
      }
    }

    // 1. Register the global CDP listener
    chrome.debugger.onEvent.addListener(onDebuggerEvent)

    // 2. Initial check in case there are no ongoing requests at the moment
    checkIdle()

    // 3. Fallback timeout to prevent our scraper from hanging infinitely
    if (timeout > 0) {
      timeoutTimer = setTimeout(() => {
        abort(new Error(`Network idle timeout of ${timeout}ms exceeded.`))
      }, timeout)
    }
  })
}
