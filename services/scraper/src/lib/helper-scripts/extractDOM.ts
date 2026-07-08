// Extract DOM via Runtime.evaluate
// This executes JS directly in the V8 engine, returning the fully hydrated outerHTML
// without needing to inject content scripts or parse complex DOM node IDs.
export async function extractDOM(target: chrome.debugger.Debuggee) {
  const { result } = (await chrome.debugger.sendCommand(
    target,
    "Runtime.evaluate",
    {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    }
  )) as any

  return result.value
}
