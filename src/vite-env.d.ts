/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}

/** Injected at build time by Vite (see vite.config.ts → define). */
declare const __APP_BUILD_HASH__: string;
