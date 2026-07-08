/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Declare our specific environment variables here
  readonly VITE_API_BASE_URL: string
  readonly VITE_SCHEDULER_POLL_INTERVAL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
