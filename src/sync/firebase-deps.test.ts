import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Sign-in breaks ("Component auth has not been registered yet") when firebase and @firebase/auth
// end up with different copies of @firebase/app. That happened once after a version change.
describe("firebase install", () => {
  it("uses one copy of @firebase/app everywhere", () => {
    const from = (pkg: string) => createRequire(createRequire(import.meta.url).resolve(`${pkg}/package.json`));
    const appFor = (pkg: string) => from(pkg).resolve("@firebase/app/package.json");
    expect(appFor("firebase")).toBe(appFor("@firebase/auth"));
    expect(appFor("firebase")).toBe(appFor("@firebase/firestore"));
  });
});
