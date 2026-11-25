const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "public/kubang-yt-icon.svg");
  const output = path.join(root, "build/brand");
  await fs.mkdir(output, { recursive: true });
  const icon = await sharp(source).resize(512, 512).png().toBuffer();
  await fs.writeFile(path.join(output, "kubang-yt.png"), icon);
  await fs.writeFile(path.join(output, "kubang-yt.ico"), await pngToIco(icon));
  if (process.argv.includes("--android")) {
    const androidRes = path.join(root, "android/app/src/main/res");
    const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    for (const [density, size] of Object.entries(densities)) {
      const dir = path.join(androidRes, `mipmap-${density}`);
      await fs.mkdir(dir, { recursive: true });
      const png = await sharp(icon).resize(size, size).png().toBuffer();
      await fs.writeFile(path.join(dir, "ic_launcher.png"), png);
      await fs.writeFile(path.join(dir, "ic_launcher_round.png"), png);
      const foreground = await sharp(source).resize(432, 432, { fit: "contain", background: { r: 8, g: 10, b: 14, alpha: 0 } }).png().toBuffer();
      await fs.writeFile(path.join(dir, "ic_launcher_foreground.png"), foreground);
    }
    const adaptive = path.join(androidRes, "mipmap-anydpi-v26");
    await fs.mkdir(adaptive, { recursive: true });
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/kubang_icon_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;
    await fs.writeFile(path.join(adaptive, "ic_launcher.xml"), xml);
    await fs.writeFile(path.join(adaptive, "ic_launcher_round.xml"), xml);
    const values = path.join(androidRes, "values");
    await fs.mkdir(values, { recursive: true });
    await fs.writeFile(path.join(values, "kubang_icon_colors.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources><color name="kubang_icon_background">#080A0E</color></resources>`);
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
