import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./pushKey";

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url string with no special characters", () => {
    // "hello" -> base64 "aGVsbG8=" -> base64url "aGVsbG8" (padding stripped)
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles base64url's - and _ characters and restores stripped padding", () => {
    // Bytes [251, 255, 191] base64-encode to "+/+/"; as base64url that's "-_-_".
    const result = urlBase64ToUint8Array("-_-_");
    expect(Array.from(result)).toEqual([251, 255, 191]);
  });
});
