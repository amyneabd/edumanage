import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("./env.js", () => ({
  env: { supabaseStorage: null },
}));

const { uploadsDir } = await import("../middleware/upload.middleware.js");
const { saveFile, deleteFile } = await import("./storage.js");

describe("storage (local disk fallback)", () => {
  it("writes the buffer to uploadsDir and returns a /uploads/ url", async () => {
    const { url, key } = await saveFile(Buffer.from("hello"), "note.pdf", "application/pdf");
    expect(url).toBe(`/uploads/${key}`);
    expect(fs.readFileSync(path.join(uploadsDir, key), "utf8")).toBe("hello");
    await deleteFile(key);
  });

  it("generates distinct keys for successive uploads of the same filename", async () => {
    const a = await saveFile(Buffer.from("a"), "note.pdf", "application/pdf");
    const b = await saveFile(Buffer.from("b"), "note.pdf", "application/pdf");
    expect(a.key).not.toBe(b.key);
    await deleteFile(a.key);
    await deleteFile(b.key);
  });

  it("deleteFile removes the file from uploadsDir", async () => {
    const { key } = await saveFile(Buffer.from("bye"), "note.pdf", "application/pdf");
    const filePath = path.join(uploadsDir, key);
    expect(fs.existsSync(filePath)).toBe(true);
    await deleteFile(key);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
