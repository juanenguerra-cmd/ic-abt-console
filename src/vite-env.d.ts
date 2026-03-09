/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}

/** Injected by vite.config.ts at build time; identifies the running bundle. */
declare const __BUILD_ID__: string;
