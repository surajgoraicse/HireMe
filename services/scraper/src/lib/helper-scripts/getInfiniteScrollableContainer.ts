// src/lib/dom-metrics.ts

import { executeScript } from "./executeScript"

export interface RectBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Dynamically finds the largest scrollable container on the page
 * and returns its bounding client rect coordinates.
 */
export async function getScrollableContainerBounds(
  target: chrome.debugger.Debuggee,
  containerSelector: string = ""
): Promise<RectBounds> {
  let expression = ""
  if (containerSelector) {
    expression = `
    (() => {
      const container = document.querySelector('${containerSelector}');
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    })();
  `
  }
  let container = await executeScript(target, expression)
  if (container) {
    return container as RectBounds
  }
  expression = `
    (() => {
      let bestElement = null;
      let maxScrollableHeight = 0;
      const allElements = document.querySelectorAll('*');
      
      for (let el of allElements) {
        // Skip hidden or non-scrollable elements
        if (el.clientHeight === 0 || el.scrollHeight <= el.clientHeight) continue;
        
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          if (el.tagName !== 'BODY' && el.tagName !== 'HTML') {
            if (el.scrollHeight > maxScrollableHeight) {
              maxScrollableHeight = el.scrollHeight;
              bestElement = el;
            }
          }
        }
      }
      
      // Fallback to the main document body if no nested container is found
      const container = bestElement || document.scrollingElement || document.body;
      const rect = container.getBoundingClientRect();
      
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    })();
  `

  return (await executeScript(target, expression)) as RectBounds
}
