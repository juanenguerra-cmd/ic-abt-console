import { describe, test, expect } from "vitest";
import { classifyError, ERROR_KIND_LABEL } from "./errorClassifier";

describe("classifyError", () => {
  test("returns 'app' for null", () => {
    expect(classifyError(null)).toBe("app");
  });

  test("returns 'app' for undefined", () => {
    expect(classifyError(undefined)).toBe("app");
  });

  test("returns 'app' for a generic error", () => {
    expect(classifyError(new Error("Something went wrong"))).toBe("app");
  });

  test("returns 'extension' for chrome-extension:// in message", () => {
    const err = new Error(
      "Failed to fetch dynamically imported module from chrome-extension://abc123/content.js"
    );
    expect(classifyError(err)).toBe("extension");
  });

  test("returns 'extension' for moz-extension:// in message", () => {
    const err = new Error("Could not load moz-extension://xyz/script.js");
    expect(classifyError(err)).toBe("extension");
  });

  test("returns 'extension' for 'Denying load of chrome-extension' message", () => {
    const err = new Error(
      "Denying load of chrome-extension://invalid/ resource"
    );
    expect(classifyError(err)).toBe("extension");
  });

  test("returns 'extension' for ERR_FAILED on extension URI in stack", () => {
    const err = new Error("net::ERR_FAILED");
    err.stack = "Error: net::ERR_FAILED\n  at chrome-extension://abc/bg.js:1:1";
    expect(classifyError(err)).toBe("extension");
  });

  test("returns 'service-worker' for service worker message", () => {
    const err = new Error("service worker registration failed");
    expect(classifyError(err)).toBe("service-worker");
  });

  test("returns 'service-worker' for sw.js in message", () => {
    const err = new Error("Failed to install sw.js: fetch error");
    expect(classifyError(err)).toBe("service-worker");
  });

  test("returns 'service-worker' for workbox in message", () => {
    const err = new Error("workbox-core precaching failed");
    expect(classifyError(err)).toBe("service-worker");
  });
});

describe("ERROR_KIND_LABEL", () => {
  test("has labels for all three kinds", () => {
    expect(ERROR_KIND_LABEL["extension"]).toContain("BROWSER EXTENSION");
    expect(ERROR_KIND_LABEL["service-worker"]).toContain("SERVICE WORKER");
    expect(ERROR_KIND_LABEL["app"]).toContain("APP ERROR");
  });
});
