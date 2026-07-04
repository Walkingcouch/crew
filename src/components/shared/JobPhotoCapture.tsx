"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const MAX_DIMENSION = 1920;

/** Downscales an image file to at most 1920px on its longest side before
 * upload, client-side canvas resize, keeps evidence photo uploads small
 * on mobile data without a server round-trip just to resize. */
function downscaleImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))), "image/jpeg", 0.85);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function JobPhotoCapture({
  bookingId,
  kind,
  onUploaded,
}: {
  bookingId: string;
  kind: "before" | "after" | "evidence";
  onUploaded?: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const resized = await downscaleImage(file);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const path = `${bookingId}/${kind}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, resized, {
        contentType: "image/jpeg",
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("job_photos").insert({
        booking_id: bookingId,
        uploader_id: user.id,
        kind,
        storage_path: path,
      });
      if (insertError) throw insertError;

      toast.show("Photo uploaded", "success");
      onUploaded?.();
    } catch (err) {
      toast.show((err as Error).message || "Could not upload photo", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        id={`photo-input-${kind}`}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading..." : `Add ${kind} photo`}
      </Button>
    </div>
  );
}
