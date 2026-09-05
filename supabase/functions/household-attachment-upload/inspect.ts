// Edge-only inspection. The heavyweight decoder is injected by the Edge entry point.
export const JPEG_DECODE_LIMITS = {
  useTArray: true as const,
  formatAsRGBA: false,
  tolerantDecoding: false,
  maxResolutionInMP: 4,
  maxMemoryUsageInMB: 96,
};
type Decoder = (
  bytes: Uint8Array,
  options: typeof JPEG_DECODE_LIMITS,
) => {
  width: number;
  height: number;
  data: Uint8Array;
};
type Component = { horizontal: number; vertical: number };
type Frame = {
  width: number;
  height: number;
  components: Map<number, Component>;
  maxHorizontal: number;
  maxVertical: number;
};
const maxBytes = 4 * 1024 * 1024;

export function inspectAttachment(bytes: Uint8Array, decode: Decoder) {
  if (bytes.length < 12 || bytes.length > maxBytes) return null;
  if ([37, 80, 68, 70, 45].every((byte, index) => bytes[index] === byte))
    return { extension: "pdf", mime: "application/pdf" };
  try {
    const frame = jpegStructure(bytes);
    const image = decode(bytes, JPEG_DECODE_LIMITS);
    if (
      image.width !== frame.width ||
      image.height !== frame.height ||
      image.data.byteLength !== frame.width * frame.height * 3
    )
      return null;
    return { extension: "jpg", mime: "image/jpeg" };
  } catch {
    return null;
  }
}
function invalid(): never {
  throw new Error("Invalid or unsupported JPEG");
}
function word(bytes: Uint8Array, offset: number) {
  if (offset + 1 >= bytes.length) return invalid();
  return bytes[offset]! * 256 + bytes[offset + 1]!;
}
function readFrame(bytes: Uint8Array, offset: number, length: number): Frame {
  if (length < 11 || bytes[offset + 2] !== 8) return invalid();
  const height = word(bytes, offset + 3),
    width = word(bytes, offset + 5);
  const count = bytes[offset + 7]!;
  if (
    !width ||
    !height ||
    width > 2000 ||
    height > 2000 ||
    width * height > 4_000_000 ||
    ![1, 3, 4].includes(count) ||
    length !== 8 + count * 3
  )
    return invalid();
  const components = new Map<number, Component>();
  let maxHorizontal = 0,
    maxVertical = 0,
    blocks = 0;
  for (let index = 0; index < count; index++) {
    const start = offset + 8 + index * 3,
      id = bytes[start]!;
    const horizontal = bytes[start + 1]! >> 4,
      vertical = bytes[start + 1]! & 15;
    if (
      !horizontal ||
      horizontal > 4 ||
      !vertical ||
      vertical > 4 ||
      components.has(id)
    )
      return invalid();
    components.set(id, { horizontal, vertical });
    maxHorizontal = Math.max(maxHorizontal, horizontal);
    maxVertical = Math.max(maxVertical, vertical);
    blocks += horizontal * vertical;
  }
  if (blocks > 10) return invalid();
  return { width, height, components, maxHorizontal, maxVertical };
}
function scanComponents(
  bytes: Uint8Array,
  offset: number,
  length: number,
  frame: Frame,
) {
  const count = bytes[offset + 2]!;
  if (count < 1 || count > 4 || length !== 6 + count * 2) return invalid();
  const selected = new Set<number>();
  for (let index = 0; index < count; index++) {
    const id = bytes[offset + 3 + index * 2]!;
    if (!frame.components.has(id) || selected.has(id)) return invalid();
    selected.add(id);
  }
  return selected;
}
function expectedRestarts(
  frame: Frame,
  selected: Set<number>,
  interval: number,
) {
  if (!interval) return 0;
  let mcus: number;
  if (selected.size === 1) {
    const component = frame.components.get([...selected][0]!)!;
    mcus =
      Math.ceil(
        (Math.ceil(frame.width / 8) * component.horizontal) /
          frame.maxHorizontal,
      ) *
      Math.ceil(
        (Math.ceil(frame.height / 8) * component.vertical) / frame.maxVertical,
      );
  } else {
    mcus =
      Math.ceil(frame.width / (8 * frame.maxHorizontal)) *
      Math.ceil(frame.height / (8 * frame.maxVertical));
  }
  return Math.floor((mcus - 1) / interval);
}
function scanEnd(bytes: Uint8Array, offset: number, restarts: number) {
  let found = 0,
    entropy = false;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 255) {
      entropy = true;
      offset++;
      continue;
    }
    const markerStart = offset++;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset];
    if (marker === 0) {
      entropy = true;
      offset++;
      continue;
    }
    if (marker !== undefined && marker >= 0xd0 && marker <= 0xd7) {
      if (marker !== 0xd0 + (found % 8)) return invalid();
      found++;
      offset++;
      continue;
    }
    if (!entropy || found !== restarts) return invalid();
    return markerStart;
  }
  return invalid();
}
function jpegStructure(bytes: Uint8Array): Frame {
  if (word(bytes, 0) !== 0xffd8) return invalid();
  let offset = 2,
    interval = 0,
    scans = 0;
  let frame: Frame | null = null;
  const scanned = new Set<number>();
  while (offset < bytes.length) {
    if (bytes[offset++] !== 255) return invalid();
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (
        offset !== bytes.length ||
        !frame ||
        !scans ||
        scanned.size !== frame.components.size
      )
        return invalid();
      return frame;
    }
    if (
      marker === undefined ||
      !(
        [0xc0, 0xc1, 0xc2, 0xc4, 0xdb, 0xdd, 0xda, 0xfe].includes(marker) ||
        (marker >= 0xe0 && marker <= 0xef)
      )
    )
      return invalid();
    const length = word(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return invalid();
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (frame) return invalid();
      frame = readFrame(bytes, offset, length);
    } else if (marker === 0xdd) {
      if (length !== 4) return invalid();
      interval = word(bytes, offset + 2);
    } else if (marker === 0xda) {
      if (!frame || ++scans > 64) return invalid();
      const selected = scanComponents(bytes, offset, length, frame);
      for (const id of selected) scanned.add(id);
      offset = scanEnd(
        bytes,
        offset + length,
        expectedRestarts(frame, selected, interval),
      );
      continue;
    }
    offset += length;
  }
  return invalid();
}
