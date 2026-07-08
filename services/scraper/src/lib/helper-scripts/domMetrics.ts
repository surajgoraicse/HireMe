import { getTimeStamp } from "../utils"

export interface ScrollMetrics {
  success: boolean
  error: string | null
  scrollHeight: number
  scrollTop: number
  clientHeight: number
  remainingSpace: number
}

/**
 * Executes a script in the target tab to retrieve real-time scroll metrics.
 */
export async function getScrollMetrics(
  target: chrome.debugger.Debuggee,
  _containerSelector: string = ""
): Promise<ScrollMetrics> {
  console.log(getTimeStamp(), "[getScrollMetrics] : Getting scroll metrics")

  let expression = ""

  // We write the JavaScript expression as a string to be evaluated in the page.
  // We check both documentElement and body to ensure cross-browser compatibility.
  expression = `
    (() => {
      const selector = 'main';
      const container = selector ? document.querySelector(selector) : null;
      if(!container) {
        return {
          success: false,
          error: "Container not found",
          scrollHeight: 0,
          scrollTop: 0,
          clientHeight: 0,
          remainingSpace: 0
        }
      }
      const scrollHeight = container.scrollHeight
      const scrollTop = container.scrollTop
      const clientHeight = container.clientHeight
      return {
        success: true,
        error: null,
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

  if (!result || !result.value) {
    console.warn(
      getTimeStamp(),
      "[getScrollMetrics] : Runtime evaluation failed, returning default metrics.",
      result?.exceptionDetails || "No result value"
    )
    throw new Error(
      "Runtime evaluation failed for getScrollMetrics ",
      result.value?.error
    )
  }
  console.log(
    getTimeStamp(),
    "[getScrollMetrics] : Scroll metrics retrieved : ",
    result?.value
  )

  return result.value as ScrollMetrics
}
