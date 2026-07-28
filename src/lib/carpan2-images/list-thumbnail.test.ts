import { createCanvas } from "@napi-rs/canvas";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createCarpan2ListThumbnail } from "./list-thumbnail";

function imageBlob(): Blob {
  const canvas = createCanvas(640, 240);
  const context = canvas.getContext("2d");
  context.fillStyle = "#123456";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const bytes = Uint8Array.from(canvas.toBuffer("image/png"));
  const blob = new Blob([bytes]);
  Object.defineProperty(blob, "arrayBuffer", {
    value: async () => {
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      return buffer;
    },
  });
  return blob;
}

describe("createCarpan2ListThumbnail", () => {
  it("reserves cleanup ownership before uploading the derivative", async () => {
    const supabase = createClient("http://127.0.0.1:54321", "fake-key", {
      auth: { persistSession: false },
    });
    const bucket = supabase.storage.from("vehicle-images");
    const events: string[] = [];
    vi.spyOn(bucket, "download").mockResolvedValue({
      data: imageBlob(),
      error: null,
    });
    vi.spyOn(bucket, "upload").mockImplementation(async () => {
      events.push("upload");
      return { data: { id: "object", path: "list.webp", fullPath: "list.webp" }, error: null };
    });
    vi.spyOn(bucket, "getPublicUrl").mockReturnValue({
      data: { publicUrl: "https://storage.example/list.webp" },
    });
    vi.spyOn(supabase.storage, "from").mockReturnValue(bucket);

    const result = await createCarpan2ListThumbnail({
      ctx: { supabase },
      storageUrl: "http://127.0.0.1:54321/storage/v1/object/public/vehicle-images/aa/source.jpg",
      reserveBeforeUpload: async () => {
        events.push("reserve");
      },
    });

    expect(events).toEqual(["reserve", "upload"]);
    expect(result).toEqual({
      url: "https://storage.example/list.webp",
      storagePath: "list-thumbnails/v1/aa/source.webp",
    });
  });

  it("does not upload when cleanup reservation fails", async () => {
    const supabase = createClient("http://127.0.0.1:54321", "fake-key", {
      auth: { persistSession: false },
    });
    const bucket = supabase.storage.from("vehicle-images");
    vi.spyOn(bucket, "download").mockResolvedValue({
      data: imageBlob(),
      error: null,
    });
    const upload = vi.spyOn(bucket, "upload");
    vi.spyOn(supabase.storage, "from").mockReturnValue(bucket);

    await expect(createCarpan2ListThumbnail({
      ctx: { supabase },
      storageUrl: "http://127.0.0.1:54321/storage/v1/object/public/vehicle-images/aa/source.jpg",
      reserveBeforeUpload: async () => {
        throw new Error("reservation conflict");
      },
    })).rejects.toThrow("reservation conflict");
    expect(upload).not.toHaveBeenCalled();
  });
});
