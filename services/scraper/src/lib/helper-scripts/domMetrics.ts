import { getTimeStamp } from "../utils"

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
  target: chrome.debugger.Debuggee,
  containerSelector: string = ""
): Promise<ScrollMetrics> {
  console.log(getTimeStamp(), "[getScrollMetrics] : Getting scroll metrics")

  let expression = ""

  // We write the JavaScript expression as a string to be evaluated in the page.
  // We check both documentElement and body to ensure cross-browser compatibility.
  expression = `
    (() => {
     const container = document.querySelector('${containerSelector}');
      const scrollHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        container.scrollHeight
      );
      const scrollTop = Math.max(
        document.documentElement.scrollTop,
        document.body.scrollTop,
        container.scrollTop
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

  console.log(
    getTimeStamp(),
    "[getScrollMetrics] : Scroll metrics retrieved : ",
    result.value
  )
  return result.value as ScrollMetrics
}
