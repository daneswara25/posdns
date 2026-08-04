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

// Build ESC/POS byte stream from a structured receipt.
function buildEscPos(r, settings) {
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
  // header (centered, bold, big)
  push([ESC, 0x61, 0x01]); // center
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
  const logo = `${window.location.origin}/logo.png`;
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
    await writeBytes(buildEscPos(r, settings));
    return "bluetooth";
  }
  printDesktop(r, settings);
  return "desktop";
}
