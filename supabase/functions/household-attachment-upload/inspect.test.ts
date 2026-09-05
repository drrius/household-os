import jpeg from "npm:jpeg-js@0.4.4";
import { inspectAttachment } from "./inspect.ts";
Deno.test(
  "Edge JPEG decoder validates maximum-size and progressive photos without browser APIs",
  async () => {
    const maximum = jpeg.encode(
      {
        width: 2000,
        height: 2000,
        data: new Uint8Array(2000 * 2000 * 4).fill(255),
      },
      85,
    ).data;
    const progressive = await Deno.readFile(
      new URL(
        "../../../tests/fixtures/attachments/progressive.jpg",
        import.meta.url,
      ),
    );
    for (const bytes of [maximum, progressive]) {
      if (inspectAttachment(bytes, jpeg.decode)?.mime !== "image/jpeg")
        throw new Error("Valid photo was rejected");
      if (
        inspectAttachment(new Uint8Array([...bytes, 0]), jpeg.decode) !== null
      )
        throw new Error("Trailing data was accepted");
    }
    const forged = new Uint8Array([
      255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 255, 217,
    ]);
    if (inspectAttachment(forged, jpeg.decode) !== null)
      throw new Error("Forged prefix was accepted");
  },
);
