import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { api } from "./model";

export interface ItemPhoto {
  photo_id: string;
  filename: string;
  checksum_sha256: string;
  width: number;
  height: number;
}

export function usePhotoDraft(key: string) {
  const [photos, setPhotos] = useState<ItemPhoto[]>(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem(key) || "[]");
      setPhotos(Array.isArray(data) ? data : []);
    } catch {
      setPhotos([]);
    }
  }, [key]);
  const save = (items: ItemPhoto[]) => {
    setPhotos(items);
    sessionStorage.setItem(key, JSON.stringify(items));
  };
  return [photos, save] as const;
}

export function PhotoCapture({
  photos,
  onChange,
  onBusy,
  notify,
}: {
  photos: ItemPhoto[];
  onChange: (photos: ItemPhoto[]) => void;
  onBusy: (busy: boolean) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length + photos.length > 12) {
      notify("Choose at most 12 photographs for this item.", true);
      return;
    }
    onBusy(true);
    setUploading(true);
    const next = [...photos];
    try {
      for (const file of Array.from(files)) {
        const data = new FormData();
        data.append("file", file);
        const photo = await api<ItemPhoto>("/photos", {
          method: "POST",
          body: data,
        });
        next.push(photo);
        onChange([...next]);
      }
      notify(
        "Item photo ready. Check the preview before accessioning the item.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      onBusy(false);
      setUploading(false);
      if (camera.current) camera.current.value = "";
      if (library.current) library.current.value = "";
    }
  };
  return (
    <section className="photo-capture">
      <div className="photo-heading">
        <div>
          <span className="eyebrow">PHOTOGRAPH THE ITEM</span>
          <h3>See what you’re preserving.</h3>
        </div>
        <Camera size={24} />
      </div>
      <p>
        Take a picture of the actual object, then check it here before it joins
        the catalogue.
      </p>
      <div className="photo-actions">
        <button
          className="button secondary"
          disabled={uploading || photos.length >= 12}
          onClick={() => camera.current?.click()}
        >
          <Camera size={17} /> Take item photo
        </button>
        <button
          className="button secondary"
          disabled={uploading || photos.length >= 12}
          onClick={() => library.current?.click()}
        >
          <ImagePlus size={17} /> Choose photos
        </button>
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Take a photo of the item"
        className="visually-hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <input
        ref={library}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label="Choose item photos"
        className="visually-hidden"
        onChange={(e) => upload(e.target.files)}
      />
      {uploading && (
        <div className="photo-uploading" role="status">
          <Loader2 size={15} className="spin" /> Preparing your photo…
        </div>
      )}
      {photos.length > 0 && (
        <>
          <div className="photo-previews">
            {photos.map((photo, i) => (
              <figure key={photo.photo_id}>
                <a
                  href={`/api/photos/${photo.photo_id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={`/api/photos/${photo.photo_id}/preview`}
                    alt={`Item photograph ${i + 1}, awaiting accession`}
                  />
                </a>
                <button
                  className="photo-remove"
                  aria-label={`Remove item photo ${i + 1}`}
                  disabled={uploading}
                  onClick={() =>
                    onChange(
                      photos.filter((p) => p.photo_id !== photo.photo_id),
                    )
                  }
                >
                  <X size={14} />
                </button>
                <figcaption>
                  <CheckCircle2 size={12} /> Photo {i + 1} · ready to attach
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="small-note">
            Check the photo is clear and shows the right item. Remove it and
            take another if needed. Photos attach when you confirm the
            accession.
          </p>
        </>
      )}
    </section>
  );
}
