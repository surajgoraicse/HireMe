export interface Config {
  logLevel: string
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
  return import.meta.env[env] || defaultVal
}

function getEnvNumberOrDefault(env: string, defaultVal: number = 0) {
  return Number(import.meta.env[env]) || defaultVal
}

function loadConfig(): Config {
  return {
    logLevel: getEnvOrDefault("VITE_LOG_LEVEL", "info"),
    minScroll: getEnvNumberOrDefault("VITE_MIN_SCROLL", 800),
    maxScroll: getEnvNumberOrDefault("VITE_MAX_SCROLL", 1500),
    minDecoyScroll: getEnvNumberOrDefault("VITE_MIN_DECOY_SCROLL", 400),
    maxDecoyScroll: getEnvNumberOrDefault("VITE_MAX_DECOY_SCROLL", 800),
    minInfiniteScrollShortSleep: getEnvNumberOrDefault(
      "VITE_MIN_INFINITE_SCROLL_SHORT_SLEEP",
      1500
    ),
    maxInfiniteScrollShortSleep: getEnvNumberOrDefault(
      "VITE_MAX_INFINITE_SCROLL_SHORT_SLEEP",
      4000
    ),
    minInfiniteScrollLongSleep: getEnvNumberOrDefault(
      "VITE_MIN_INFINITE_SCROLL_LONG_SLEEP",
      4000
    ),
    maxInfiniteScrollLongSleep: getEnvNumberOrDefault(
      "VITE_MAX_INFINITE_SCROLL_LONG_SLEEP",
      10000
    ),
    minInfiniteDecoyScrollSleep: getEnvNumberOrDefault(
      "VITE_MIN_INFINITE_DECOY_SCROLL_SLEEP",
      1000
    ),
    maxInfiniteDecoyScrollSleep: getEnvNumberOrDefault(
      "VITE_MAX_INFINITE_DECOY_SCROLL_SLEEP",
      3000
    ),
    targetLinkedinInfiniteScrollableSelector: getEnvOrDefault(
      "VITE_TARGET_LINKEDIN_INFINITE_SCROLLABLE_SELECTOR",
      "main"
    ),
  }
}
export const config = loadConfig()
