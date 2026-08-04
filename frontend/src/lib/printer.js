// Thermal (Bluetooth BLE / ESC-POS) + Desktop (HTML iframe) printing utilities.

let btDevice = null;
let btChar = null;
let btName = "";

export const rp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export const bluetoothSupported = () => typeof navigator !== "undefined" && !!navigator.bluetooth;
export const isPrinterConnected = () => !!btChar;
export const getPrinterName = () => btName;

// Connect to a BLE thermal printer and locate a writable characteristic.
export async function connectBluetoothPrinter() {
  if (!bluetoothSupported()) {
    throw new Error("Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Windows.");
  }
  const KNOWN_SERVICES = [
    0x18f0, 0xffe0, 0xff00, 0xfff0, 0xe0ff,
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "000018f0-0000-1000-8000-00805f9b34fb",
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "0000fff0-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  ];
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_SERVICES,
  });
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  let writable = null;
  for (const s of services) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) { writable = c; break; }
    }
    if (writable) break;
  }
  if (!writable) throw new Error("Karakteristik tulis printer tidak ditemukan. Pastikan printer mendukung BLE.");
  btDevice = device;
  btChar = writable;
  btName = device.name || "Printer Thermal";
  device.addEventListener("gattserverdisconnected", () => { btChar = null; });
  return btName;
}

export function disconnectPrinter() {
  try { if (btDevice?.gatt?.connected) btDevice.gatt.disconnect(); } catch (e) {}
  btChar = null; btDevice = null; btName = "";
}

async function writeBytes(bytes) {
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    if (btChar.properties.writeWithoutResponse) await btChar.writeValueWithoutResponse(chunk);
    else await btChar.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 20));
  }
}

// Convert an image (data URL or same-origin path) to an ESC/POS raster command (GS v 0).
async function imageToRaster(src) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  const MAXW = 384; // 58mm printable width in dots
  let w = img.width, h = img.height;
  if (w > MAXW) { h = Math.round((h * MAXW) / w); w = MAXW; }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const bytesPerRow = Math.ceil(w / 8);
  const raster = new Uint8Array(bytesPerRow * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const rr = data[idx], gg = data[idx + 1], bb = data[idx + 2], aa = data[idx + 3];
      const nearWhite = rr > 230 && gg > 230 && bb > 230;
      if (aa > 128 && !nearWhite) raster[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x % 8));
    }
  }
  const header = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff];
  return new Uint8Array([...header, ...raster]);
}

// Build ESC/POS byte stream from a structured receipt.
async function buildEscPos(r, settings) {
  const enc = new TextEncoder();
  const out = [];
  const push = (arr) => out.push(...arr);
  const text = (str) => push(Array.from(enc.encode(str)));
  const ESC = 0x1b, GS = 0x1d;
  const WIDTH = 32; // 58mm ~32 chars

  const row = (l, rr) => {
    const left = String(l), right = String(rr);
    const space = Math.max(1, WIDTH - left.length - right.length);
    return left + " ".repeat(space) + right + "\n";
  };
  const divider = "-".repeat(WIDTH) + "\n";

  push([ESC, 0x40]); // init
  push([ESC, 0x61, 0x01]); // center
  // logo raster (uploaded custom logo, else app default)
  const logoSrc = settings.logo || `${window.location.origin}/logo.png`;
  try {
    const raster = await imageToRaster(logoSrc);
    push(Array.from(raster));
    push([0x0a]);
  } catch (e) { /* skip logo if it fails */ }
  push([ESC, 0x21, 0x30]); // double height+width
  text((settings.business_name || "Daneswara POS") + "\n");
  push([ESC, 0x21, 0x00]); // normal
  if (settings.address) text(settings.address + "\n");
  if (settings.phone) text(settings.phone + "\n");
  push([ESC, 0x61, 0x00]); // left
  text(divider);
  text(r.invoice ? `${r.invoice}\n` : `${r.order_number || ""}\n`);
  text(`${new Date(r.created_at).toLocaleString("id-ID")}\n`);
  if (r.customer_name) text(`Nama: ${r.customer_name}\n`);
  if (r.cashier) text(`Kasir: ${r.cashier}\n`);
  text(divider);
  (r.items || []).forEach((i) => {
    text(`${i.qty}x ${i.name}\n`);
    text(row("", rp(i.price * i.qty)));
  });
  text(divider);
  text(row("Subtotal", rp(r.subtotal)));
  if (r.discount) text(row("Diskon", "-" + rp(r.discount)));
  if (r.tax) text(row(`Pajak(${r.tax_rate}%)`, rp(r.tax)));
  push([ESC, 0x21, 0x08]); // bold
  text(row("TOTAL", rp(r.total)));
  push([ESC, 0x21, 0x00]);
  if (r.deposit_amount != null && (r.deposit_amount || r.remaining != null)) {
    text(row("Deposit (DP)", rp(r.deposit_amount)));
    text(row(r.status === "Selesai" ? "Lunas" : "Sisa", rp(r.remaining)));
  } else {
    text(row(r.payment_method || "Bayar", rp(r.paid_amount)));
    if (r.change) text(row("Kembalian", rp(r.change)));
  }
  text(divider);
  push([ESC, 0x61, 0x01]); // center
  text((settings.receipt_footer || "Terima kasih telah berbelanja!") + "\n");
  push([0x0a, 0x0a, 0x0a]); // feed
  push([GS, 0x56, 0x42, 0x00]); // partial cut (ignored if unsupported)
  return new Uint8Array(out);
}

// Desktop / HTML print via hidden iframe (works on all devices).
export function printDesktop(r, settings) {
  const logo = settings.logo || `${window.location.origin}/logo.png`;
  const line = (l, rr) => `<div class="row"><span>${l}</span><span>${rr}</span></div>`;
  const items = (r.items || [])
    .map((i) => line(`${i.qty}x ${i.name}`, rp(i.price * i.qty)))
    .join("");
  const isOrder = r.deposit_amount != null && r.remaining != null && !r.paid_amount;
  const payRows = isOrder
    ? line("Deposit (DP)", rp(r.deposit_amount)) + line(r.status === "Selesai" ? "Lunas" : "Sisa", rp(r.remaining))
    : line(r.payment_method || "Bayar", rp(r.paid_amount)) + line("Kembalian", rp(r.change || 0));
  const html = `<html><head><title>${r.invoice || r.order_number || "Struk"}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { font-family: 'Courier New', monospace; font-size: 12px; box-sizing: border-box; }
  body { margin: 0; color: #000; }
  h2 { text-align: center; font-size: 14px; margin: 4px 0; }
  p.sub { text-align: center; margin: 0; font-size: 11px; }
  img.logo { display:block; margin: 0 auto 4px; max-width: 140px; max-height: 90px; object-fit: contain; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .bold { font-weight: bold; }
  .center { text-align: center; }
</style></head><body>
  <img class="logo" src="${logo}" onerror="this.style.display='none'"/>
  <h2>${settings.business_name || "Daneswara POS"}</h2>
  ${settings.address ? `<p class="sub">${settings.address}</p>` : ""}
  ${settings.phone ? `<p class="sub">${settings.phone}</p>` : ""}
  <div class="divider"></div>
  <div class="row"><span>${r.invoice || r.order_number || ""}</span></div>
  <div class="row"><span>${new Date(r.created_at).toLocaleString("id-ID")}</span></div>
  ${r.customer_name ? `<div class="row"><span>Nama: ${r.customer_name}</span></div>` : ""}
  ${r.cashier ? `<div class="row"><span>Kasir: ${r.cashier}</span></div>` : ""}
  <div class="divider"></div>
  ${items}
  <div class="divider"></div>
  ${line("Subtotal", rp(r.subtotal))}
  ${r.discount ? line("Diskon", "-" + rp(r.discount)) : ""}
  ${r.tax ? line(`Pajak (${r.tax_rate}%)`, rp(r.tax)) : ""}
  <div class="row bold"><span>TOTAL</span><span>${rp(r.total)}</span></div>
  ${payRows}
  <div class="divider"></div>
  ${r.note ? `<p class="sub">Catatan: ${r.note}</p>` : ""}
  <p class="center">${settings.receipt_footer || "Terima kasih telah berbelanja!"}</p>
</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}

// Main entry: prints according to selected mode. Falls back to desktop on error.
export async function printReceiptSmart(r, settings) {
  const mode = settings.print_mode || "desktop";
  if (mode === "bluetooth") {
    if (!isPrinterConnected()) throw new Error("Printer Bluetooth belum terhubung. Hubungkan di menu Pengaturan.");
    await writeBytes(await buildEscPos(r, settings));
    return "bluetooth";
  }
  printDesktop(r, settings);
  return "desktop";
}
