# Attachment validation and retry recovery

New uploads to the private Edge endpoint accept PDFs and JPEGs. The browser still accepts photos in PNG, WebP, and other browser-decodable image formats: it converts them to JPEG, with a maximum edge of 2,000 pixels, before uploading. Existing PNG and WebP attachments remain readable. PDF detection checks its file signature; this change does not claim to validate the full PDF document structure.

JPEG inspection happens before upload reservation and privileged Storage writes. The Edge-only module uses pinned `jpeg-js@0.4.4` with strict decoding, a 4-megapixel limit, a 96 MiB decoder allocation limit, and RGB output. Input bytes are limited to 4 MiB, and neither dimension can exceed 2,000 pixels. A structural scan additionally requires complete segments, frame/component consistency, the expected restart-marker count and order for each scan, and an end-of-image marker exactly at the end of the file. This rejects prefix-only files, truncated entropy streams, and appended payloads. Baseline, progressive, ordinary EXIF, and comment metadata are supported. The browser's header detector is only a preparation hint and is never used as proof of image validity.

The decoder's allocation cap is not a process-wide heap limit. The 96 MiB cap accommodates a valid 2,000 × 2,000 4:4:4 JPEG plus RGB output; a 64 MiB cap rejects that ordinary maximum-size case. Tests exercise the 4-megapixel case in both Node and Deno. The decoder never enters the client bundle: only the Edge entry point and test modules import it. Household identity, file path, extension, and content type are derived on the server; client MIME types and filenames cannot select the stored format or destination.

The upload protocol expects browser-normalized JPEGs, rather than every possible JPEG encoding. Independent review found that the strict decoder rejects a valid grayscale image with a partial final restart interval. The normal picker decodes and re-encodes that image before upload, avoiding this decoder limitation. Direct callers must normalize unsupported encodings; validation remains strict.

A reservation rejection with SQLSTATE `22023` means that upload identity expired or is otherwise permanently invalid, so the browser asks for a new file selection. Infrastructure failures return a retryable 503 and retain the original upload identity. Authentication failures retain their 401/403 meaning. Local preparation failures (unsupported files, undecodable photos, and oversized PDFs) clear the pending attempt and file input, block saving, and require another selection. Re-selecting the same filename still triggers preparation. A successful retry after a transient failure uses the same identity and cannot create a duplicate file.

## Verification

Run focused application tests with:

```sh
pnpm exec vitest run src/domain/attachments src/lib/attachments src/app/api/attachments/route.test.ts
pnpm exec playwright test tests/e2e/attachments.spec.ts
```

Validate the actual Edge decoder and entry point without uploading or deploying:

```sh
deno test --no-config --no-lock --allow-read supabase/functions/household-attachment-upload/inspect.test.ts
deno check --no-config --no-lock supabase/functions/household-attachment-upload/index.ts
```

`tests/fixtures/attachments/progressive.jpg` and `restarts.jpg` are generated 64 × 64 color gradients, created locally from a PPM using `cjpeg -progressive` and `cjpeg -restart 1B`. They contain no user photos. Unit tests mutate copies to verify truncated streams and invalid restart boundaries, and generate their own maximum-size image using the same pinned codec.
