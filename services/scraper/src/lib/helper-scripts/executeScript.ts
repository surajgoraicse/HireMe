export async function executeScript(
  target: chrome.debugger.Debuggee,
  expression: string
) {
  const { result } = (await chrome.debugger.sendCommand(
    target,
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
    }
  )) as any
  return result.value
}
