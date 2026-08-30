import { describe, expect, it, vi } from "vitest";

const { uploadMock, getPublicUrlMock, removeMock, createClientMock } = vi.hoisted(() => {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = vi.fn().mockReturnValue({
    data: { publicUrl: "https://supabase.test/storage/v1/object/public/uploads/key.pdf" },
  });
  const removeMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn().mockReturnValue({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
    remove: removeMock,
  });
  const createClientMock = vi.fn().mockReturnValue({ storage: { from: fromMock } });
  return { uploadMock, getPublicUrlMock, removeMock, createClientMock };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("./env.js", () => ({
  env: {
    supabaseStorage: {
      url: "https://supabase.test",
      serviceRoleKey: "service-role-key",
      bucket: "uploads",
    },
  },
}));

const { saveFile, deleteFile } = await import("./storage.js");

describe("storage (Supabase Storage backend)", () => {
  it("uploads the buffer to Supabase Storage and returns the public URL", async () => {
    const { url, key } = await saveFile(Buffer.from("hello"), "note.pdf", "application/pdf");
    expect(createClientMock).toHaveBeenCalledWith("https://supabase.test", "service-role-key");
    expect(uploadMock).toHaveBeenCalledWith(key, expect.any(Buffer), { contentType: "application/pdf" });
    expect(url).toBe("https://supabase.test/storage/v1/object/public/uploads/key.pdf");
  });

  it("deleteFile calls remove with the given key", async () => {
    await deleteFile("some-key.pdf");
    expect(removeMock).toHaveBeenCalledWith(["some-key.pdf"]);
  });

  it("throws when the upload fails", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "bucket not found" } });
    await expect(saveFile(Buffer.from("x"), "note.pdf", "application/pdf")).rejects.toThrow("bucket not found");
  });
});
