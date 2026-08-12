// Vitest environment setup (jsdom).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom doesn't implement window.scrollTo (used by App's ScrollReset).
beforeEach(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});
