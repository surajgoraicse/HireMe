export interface Config {
  minScroll: number
  maxScroll: number
  minDecoyScroll: number
  maxDecoyScroll: number
  minInfiniteScrollShortSleep: number
  maxInfiniteScrollShortSleep: number
  minInfiniteScrollLongSleep: number
  maxInfiniteScrollLongSleep: number
  minInfiniteDecoyScrollSleep: number
  maxInfiniteDecoyScrollSleep: number
  targetLinkedinInfiniteScrollableSelector: string
}

// function getEnv(env: string) {
//   if (!process.env[env]) {
//     throw new Error(`Environment variable ${env} is not set`)
//   }
//   return process.env[env] as string
// }
// function getEnvNumber(env: string): number {
//   const envVal = getEnv(env)
//   return Number(envVal)
// }

function getEnvOrDefault(env: string, defaultVal: string = "") {
  return process.env[env] || defaultVal
}

function getEnvNumberOrDefault(env: string, defaultVal: number = 0) {
  return Number(process.env[env]) || defaultVal
}

export function loadConfig(): Config {
  return {
    minScroll: getEnvNumberOrDefault("MIN_SCROLL", 800),
    maxScroll: getEnvNumberOrDefault("MAX_SCROLL", 1500),
    minDecoyScroll: getEnvNumberOrDefault("MIN_DECOY_SCROLL", 400),
    maxDecoyScroll: getEnvNumberOrDefault("MAX_DECOY_SCROLL", 800),
    minInfiniteScrollShortSleep: getEnvNumberOrDefault(
      "MIN_INFINITE_SCROLL_SHORT_SLEEP",
      1500
    ),
    maxInfiniteScrollShortSleep: getEnvNumberOrDefault(
      "MAX_INFINITE_SCROLL_SHORT_SLEEP",
      4000
    ),
    minInfiniteScrollLongSleep: getEnvNumberOrDefault(
      "MIN_INFINITE_SCROLL_LONG_SLEEP",
      4000
    ),
    maxInfiniteScrollLongSleep: getEnvNumberOrDefault(
      "MAX_INFINITE_SCROLL_LONG_SLEEP",
      10000
    ),
    minInfiniteDecoyScrollSleep: getEnvNumberOrDefault(
      "MIN_INFINITE_DECOY_SCROLL_SLEEP",
      1000
    ),
    maxInfiniteDecoyScrollSleep: getEnvNumberOrDefault(
      "MAX_INFINITE_DECOY_SCROLL_SLEEP",
      3000
    ),
    targetLinkedinInfiniteScrollableSelector: getEnvOrDefault(
      "TARGET_LINKEDIN_INFINITE_SCROLLABLE_SELECTOR",
      ""
    ),
  }
}
