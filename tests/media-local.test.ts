import { describe, expect, it } from "vitest";
import { LocalMediaStorage } from "../src/lib/media/local.js";

describe("local media storage", () => {
  const storage = new LocalMediaStorage();

  it("round-trips a put/get/delete", async () => {
    const key = "some-content-id/photo.webp";
    await storage.put(key, Buffer.from("fake-image-bytes"), "image/webp");

    const object = await storage.getObjectStream(key);
    expect(object.mimeType).toBe("image/webp");

    await storage.delete(key);
  });

  it("rejects path traversal attempts", async () => {
    await expect(storage.put("../../etc/passwd", Buffer.from("x"), "image/webp")).rejects.toThrow();
    await expect(storage.getObjectStream("../../etc/passwd")).rejects.toThrow();
  });
});
