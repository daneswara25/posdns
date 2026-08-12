import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/api";
import { rp, normalizePhone } from "@/lib/printer";
import { toast } from "sonner";
import { MessageCircle, Copy, Image as ImageIcon, FileText } from "lucide-react";

// Plain-text quotation for WhatsApp / clipboard (distinct from paid receipt text).
export function buildDraftText(o, settings = {}) {
  const L = [];
  L.push("*PENAWARAN / DRAFT PESANAN*");
  L.push(`*${settings.business_name || "Daneswara POS"}*`);
  if (settings.address) L.push(settings.address);
  if (settings.phone) L.push(`Telp: ${settings.phone}`);
  L.push("--------------------------------");
  L.push(`No    : ${o.order_number || "-"}`);
  L.push(`Tgl   : ${new Date(o.created_at).toLocaleString("id-ID")}`);
  if (o.customer_name) L.push(`Nama  : ${o.customer_name}`);
  if (o.order_type) L.push(`Jenis : ${o.order_type}`);
  L.push("--------------------------------");
  (o.items || []).forEach((i) => {
    L.push(`${i.qty} x ${i.name}`);
    L.push(`     @${rp(i.price)}  =  ${rp(i.price * i.qty)}`);
    if (i.note) L.push(`     * ${i.note}`);
  });
  L.push("--------------------------------");
  L.push(`Subtotal : ${rp(o.subtotal)}`);
  if (o.discount) L.push(`Diskon   : -${rp(o.discount)}`);
  if (o.tax) L.push(`Pajak    : ${rp(o.tax)}`);
  L.push(`*TOTAL   : ${rp(o.total)}*`);
  L.push("--------------------------------");
  L.push("⚠️ Pesanan ini *BELUM DIBAYAR*.");
  L.push("Mohon konfirmasi untuk kami proses. Terima kasih 🙏");
  return L.join("\n");
}

// Preview/quotation dialog for DRAFT (unpaid) orders — deliberately styled
// differently from the paid NotaDialog (amber quotation vs blue receipt).
export function DraftPreviewDialog({ order, onClose, settings = {} }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  useEffect(() => { setPhone(order?.customer_phone || ""); }, [order]);

  const open = !!order;
  const items = order?.items || [];

  const doWa = () => {
    const text = buildDraftText(order, settings);
    const d = normalizePhone(phone);
    const url = d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    if (!d) toast.info("Nomor kosong — pilih kontak di WhatsApp");
  };
  const doCopy = async () => {
    const text = buildDraftText(order, settings);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    toast.success("Draft pesanan disalin — tinggal tempel di WhatsApp");
  };
  const shareImage = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: "#1c1917" });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const fname = `penawaran-${order.order_number || "draft"}.png`;
      const file = new File([blob], fname, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Penawaran Pesanan", text: `Penawaran ${order.order_number || ""}` }); }
        catch (err) { if (err?.name !== "AbortError") throw err; }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        toast.success("Gambar penawaran diunduh — tinggal lampirkan di WhatsApp");
      }
    } catch (e) { toast.error("Gagal membuat gambar penawaran"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="draft-preview-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileText className="h-5 w-5 text-amber-500" /> Preview Penawaran
          </DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 px-3 py-2 text-center text-sm font-bold uppercase tracking-wide text-amber-600" data-testid="draft-status-badge">
              Draft — Belum Bayar
            </div>
            <div className="rounded-md bg-secondary/50 p-3 font-mono text-xs">
              <p className="text-center font-bold">{settings.business_name || "Daneswara POS"}</p>
              <p className="mt-1 text-center">{order.order_number}</p>
              <p className="text-center text-muted-foreground">{new Date(order.created_at).toLocaleString("id-ID")}</p>
              {order.customer_name && <p className="text-center">Nama: {order.customer_name}</p>}
              {order.order_type && <p className="text-center">Jenis: {order.order_type}</p>}
              <div className="my-2 border-t border-dashed border-border" />
              {items.map((i, idx) => (
                <div key={idx}>
                  <div className="flex justify-between"><span>{i.qty}x {i.name}</span><span>{rupiah(i.price * i.qty)}</span></div>
                  {i.note && <p className="pl-2 italic text-muted-foreground">* {i.note}</p>}
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(order.subtotal)}</span></div>
              {order.discount ? <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(order.discount)}</span></div> : null}
              {order.tax ? <div className="flex justify-between"><span>Pajak</span><span>{rupiah(order.tax)}</span></div> : null}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{rupiah(order.total)}</span></div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Nomor WhatsApp pelanggan</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="cth: 08123456789" data-testid="draft-wa-phone-input" />
            </div>
            <Button className="w-full gap-2 bg-amber-500 text-white hover:bg-amber-600" onClick={shareImage} disabled={busy} data-testid="draft-share-image-button">
              <ImageIcon className="h-4 w-4" /> {busy ? "Membuat gambar..." : "Bagikan Penawaran sebagai Gambar"}
            </Button>
            <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" onClick={doWa} data-testid="draft-whatsapp-button">
              <MessageCircle className="h-4 w-4" /> Kirim Penawaran via WhatsApp
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 gap-2" onClick={doCopy} data-testid="draft-copy-button"><Copy className="h-4 w-4" /> Salin Pesanan</Button>
              <Button className="flex-1" onClick={onClose} data-testid="draft-close-button">Tutup</Button>
            </div>
          </div>
        )}

        {/* Offscreen quotation card — dark amber theme (distinct from paid receipt). */}
        {order && (
          <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
            <div ref={cardRef} style={{ width: "460px", padding: "22px", background: "#1c1917", fontFamily: "Arial, Helvetica, sans-serif" }}>
              <div style={{ background: "#fffbeb", borderRadius: "18px", overflow: "hidden", border: "2px dashed #f59e0b", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
                <div style={{ background: "linear-gradient(135deg,#78350f,#b45309)", color: "#fffbeb", padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <img src={settings.logo || "/logo.png"} alt="" crossOrigin="anonymous" style={{ maxWidth: "40px", maxHeight: "40px", objectFit: "contain" }} />
                    </div>
                    <div style={{ lineHeight: 1.25 }}>
                      <div style={{ fontSize: "12px", letterSpacing: "2px", fontWeight: 700, opacity: 0.85 }}>PENAWARAN PESANAN</div>
                      <div style={{ fontSize: "19px", fontWeight: 800 }}>{settings.business_name || "Daneswara POS"}</div>
                      {settings.phone ? <div style={{ fontSize: "11px", opacity: 0.9 }}>Telp: {settings.phone}</div> : null}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "18px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#1c1917" }}>{order.order_number}</div>
                      <div style={{ fontSize: "11px", color: "#78716c" }}>{new Date(order.created_at).toLocaleString("id-ID")}</div>
                    </div>
                    <div style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #f59e0b", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 800, letterSpacing: "1px" }}>BELUM BAYAR</div>
                  </div>

                  <div style={{ fontSize: "12px", color: "#44403c", marginBottom: "10px" }}>
                    <div>Pelanggan: <b>{order.customer_name || "Umum"}</b></div>
                    {order.order_type ? <div>Jenis Pesanan: <b>{order.order_type}</b></div> : null}
                  </div>

                  <div style={{ borderTop: "1px dashed #d6d3d1", paddingTop: "10px" }}>
                    {items.map((i, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                        <div style={{ maxWidth: "280px" }}>
                          <div style={{ color: "#1c1917" }}>{i.name}</div>
                          <div style={{ fontSize: "11px", color: "#a8a29e" }}>{i.qty} x {rupiah(i.price)}{i.note ? ` • ${i.note}` : ""}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: "#1c1917" }}>{rupiah(i.price * i.qty)}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px dashed #d6d3d1", marginTop: "8px", paddingTop: "10px", fontSize: "13px", color: "#44403c" }}>
                    <QRow l="Subtotal" r={rupiah(order.subtotal)} />
                    {order.discount ? <QRow l="Diskon" r={`-${rupiah(order.discount)}`} /> : null}
                    {order.tax ? <QRow l="Pajak" r={rupiah(order.tax)} /> : null}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 800, color: "#b45309", margin: "8px 0 4px" }}>
                      <span>TOTAL</span><span>{rupiah(order.total)}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "12px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "10px", padding: "10px 12px", fontSize: "11px", color: "#92400e", textAlign: "center" }}>
                    Pesanan ini <b>belum dibayar</b>. Mohon konfirmasi untuk kami proses. 🙏
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QRow({ l, r }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
      <span style={{ color: "#78716c" }}>{l}</span><span>{r}</span>
    </div>
  );
}
