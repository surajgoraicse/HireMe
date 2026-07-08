import log, { type LogLevelDesc } from "loglevel"
import { config } from "./config"

function newLogger(level: LogLevelDesc) {
  try {
    log.setLevel(level)
  } catch (error) {
    log.setLevel("debug")
    console.error(
      "Failed to set log level to",
      level,
      "setting to debug",
      error
    )
  } finally {
    return log
  }
}

const logger = newLogger(config.logLevel as LogLevelDesc)
export default logger
