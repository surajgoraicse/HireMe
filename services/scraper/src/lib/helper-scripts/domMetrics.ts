import logger from "../logger"

export interface ScrollMetrics {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
  remainingSpace: number
}

/**
 * Executes a script in the target tab to retrieve real-time scroll metrics.
 */
export async function getScrollMetrics(
  target: chrome.debugger.Debuggee
): Promise<ScrollMetrics> {
  logger.info("[getScrollMetrics] : Getting scroll metrics")
  // We write the JavaScript expression as a string to be evaluated in the page.
  // We check both documentElement and body to ensure cross-browser compatibility.
  const expression = `
    (() => {
      const scrollHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const scrollTop = Math.max(
        document.documentElement.scrollTop,
        document.body.scrollTop
      );
      const clientHeight = document.documentElement.clientHeight;
      
      return {
        scrollHeight,
        scrollTop,
        clientHeight,
        remainingSpace: scrollHeight - (scrollTop + clientHeight)
      };
    })();
  `

  // We must set returnByValue: true so the debugger returns the actual JSON object
  // instead of a useless RemoteObjectId reference.
  const { result } = (await chrome.debugger.sendCommand(
    target,
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
    }
  )) as any

  logger.info("[getScrollMetrics] : Scroll metrics retrieved : ", result.value)
  return result.value as ScrollMetrics
}
