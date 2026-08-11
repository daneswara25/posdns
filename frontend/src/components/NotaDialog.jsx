import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/api";
import { printReceiptSmart, paymentStatus, sendReceiptWhatsApp, copyReceiptText } from "@/lib/printer";
import { toast } from "sonner";
import { MessageCircle, Copy, Printer, Image as ImageIcon } from "lucide-react";

// Reusable nota/receipt dialog with Cetak / Kirim WA (teks) / Salin / Bagikan Gambar.
export function NotaDialog({ nota, onClose, settings = {} }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  useEffect(() => { setPhone(nota?.customer_phone || ""); }, [nota]);

  const open = !!nota;
  const status = nota ? paymentStatus(nota) : "";
  const isDeposit = status === "DEPOSIT";

  const doPrint = async () => {
    try {
      const mode = await printReceiptSmart(nota, settings);
      if (mode === "bluetooth") toast.success("Nota dikirim ke printer Bluetooth");
    } catch (e) { toast.error(e.message || "Gagal mencetak nota"); }
  };
  const doWa = () => {
    const ok = sendReceiptWhatsApp(nota, settings, phone);
    if (!ok) toast.info("Nomor tujuan kosong — pilih kontak di WhatsApp");
  };
  const doCopy = async () => { await copyReceiptText(nota, settings); toast.success("Nota disalin — tinggal tempel di WhatsApp pelanggan"); };

  const shareImage = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: "#eef2f7" });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const fname = `nota-${nota.invoice || nota.order_number || "struk"}.png`;
      const file = new File([blob], fname, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Nota Transaksi", text: `Nota ${nota.invoice || nota.order_number || ""}` });
        } catch (err) { if (err?.name !== "AbortError") throw err; }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        toast.success("Gambar nota diunduh — tinggal lampirkan di WhatsApp");
      }
    } catch (e) {
      toast.error("Gagal membuat gambar nota");
    } finally { setBusy(false); }
  };

  const badge = isDeposit ? { bg: "#fff7ed", fg: "#c2410c", br: "#fdba74" } : { bg: "#ecfdf5", fg: "#15803d", br: "#86efac" };
  const items = nota?.items || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="nota-dialog">
        <DialogHeader><DialogTitle className="font-display">Nota Transaksi</DialogTitle></DialogHeader>
        {nota && (
          <div className="space-y-3">
            <div className={`rounded-md px-3 py-2 text-center text-sm font-bold ${isDeposit ? "bg-orange-500/15 text-orange-600" : "bg-emerald-500/15 text-emerald-600"}`} data-testid="nota-status">
              {status}
            </div>
            <div className="rounded-md bg-secondary/50 p-3 font-mono text-xs">
              <p className="text-center font-bold">{settings.business_name || "Daneswara POS"}</p>
              <p className="mt-1 text-center">{nota.invoice || nota.order_number}</p>
              <p className="text-center text-muted-foreground">{new Date(nota.created_at).toLocaleString("id-ID")}</p>
              {nota.customer_name && <p className="text-center">Nama: {nota.customer_name}</p>}
              <div className="my-2 border-t border-dashed border-border" />
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between"><span>{i.qty}x {i.name}</span><span>{rupiah(i.price * i.qty)}</span></div>
              ))}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(nota.subtotal)}</span></div>
              {nota.discount ? <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(nota.discount)}</span></div> : null}
              {nota.tax ? <div className="flex justify-between"><span>Pajak</span><span>{rupiah(nota.tax)}</span></div> : null}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{rupiah(nota.total)}</span></div>
              {nota.deposit_amount != null ? (
                <>
                  <div className="flex justify-between"><span>Deposit (DP)</span><span>{rupiah(nota.deposit_amount)}</span></div>
                  <div className="flex justify-between"><span>{isDeposit ? "Sisa" : "Pelunasan"}</span><span>{rupiah(isDeposit ? nota.remaining : (nota.settle_paid ?? 0))}</span></div>
                </>
              ) : (
                <div className="flex justify-between"><span>Bayar ({nota.payment_method})</span><span>{rupiah(nota.paid_amount)}</span></div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Nomor WhatsApp pelanggan</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="cth: 08123456789" data-testid="nota-wa-phone-input" />
            </div>
            <Button className="w-full gap-2" onClick={shareImage} disabled={busy} data-testid="nota-share-image-button">
              <ImageIcon className="h-4 w-4" /> {busy ? "Membuat gambar..." : "Bagikan Nota sebagai Gambar"}
            </Button>
            <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" onClick={doWa} data-testid="nota-whatsapp-button">
              <MessageCircle className="h-4 w-4" /> Kirim Teks via WhatsApp
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 gap-2" onClick={doCopy} data-testid="nota-copy-button"><Copy className="h-4 w-4" /> Salin</Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={doPrint} data-testid="nota-print-button"><Printer className="h-4 w-4" /> Cetak</Button>
              <Button className="flex-1" onClick={onClose} data-testid="nota-close-button">Tutup</Button>
            </div>
          </div>
        )}

        {/* Offscreen card used to render the shareable image (inline hex styles for html2canvas) */}
        {nota && (
          <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
            <div ref={cardRef} style={{ width: "460px", padding: "22px", background: "#eef2f7", fontFamily: "Arial, Helvetica, sans-serif" }}>
              <div style={{ background: "#ffffff", borderRadius: "18px", overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}>
                <div style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)", color: "#ffffff", padding: "20px 22px", display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src={settings.logo || "/logo.png"} alt="" crossOrigin="anonymous" style={{ maxWidth: "40px", maxHeight: "40px", objectFit: "contain" }} />
                  </div>
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontSize: "19px", fontWeight: 800 }}>{settings.business_name || "Daneswara POS"}</div>
                    {settings.address ? <div style={{ fontSize: "11px", opacity: 0.9 }}>{settings.address}</div> : null}
                    {settings.phone ? <div style={{ fontSize: "11px", opacity: 0.9 }}>Telp: {settings.phone}</div> : null}
                  </div>
                </div>

                <div style={{ padding: "18px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>{nota.invoice || nota.order_number}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{new Date(nota.created_at).toLocaleString("id-ID")}</div>
                    </div>
                    <div style={{ background: badge.bg, color: badge.fg, border: `1px solid ${badge.br}`, borderRadius: "999px", padding: "5px 12px", fontSize: "12px", fontWeight: 800 }}>{status}</div>
                  </div>

                  <div style={{ fontSize: "12px", color: "#334155", marginBottom: "10px" }}>
                    <div>Pelanggan: <b>{nota.customer_name || "Umum"}</b></div>
                    {nota.cashier ? <div>Kasir: {nota.cashier}</div> : null}
                  </div>

                  <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "10px" }}>
                    {items.map((i, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                        <div style={{ maxWidth: "260px" }}>
                          <div style={{ color: "#0f172a" }}>{i.name}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{i.qty} x {rupiah(i.price)}{i.note ? ` • ${i.note}` : ""}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{rupiah(i.price * i.qty)}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px dashed #cbd5e1", marginTop: "8px", paddingTop: "10px", fontSize: "13px", color: "#334155" }}>
                    <Row l="Subtotal" r={rupiah(nota.subtotal)} />
                    {nota.discount ? <Row l="Diskon" r={`-${rupiah(nota.discount)}`} /> : null}
                    {nota.tax ? <Row l="Pajak" r={rupiah(nota.tax)} /> : null}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "17px", fontWeight: 800, color: "#0f172a", margin: "6px 0" }}>
                      <span>TOTAL</span><span>{rupiah(nota.total)}</span>
                    </div>
                    {nota.deposit_amount != null ? (
                      <>
                        <Row l="Deposit (DP)" r={rupiah(nota.deposit_amount)} />
                        <Row l={isDeposit ? "Sisa Tagihan" : "Pelunasan"} r={rupiah(isDeposit ? nota.remaining : (nota.settle_paid ?? 0))} />
                      </>
                    ) : (
                      <Row l={`Bayar (${nota.payment_method})`} r={rupiah(nota.paid_amount)} />
                    )}
                  </div>

                  <div style={{ textAlign: "center", marginTop: "14px", fontSize: "11px", color: "#94a3b8" }}>
                    {settings.receipt_footer || "Terima kasih telah berbelanja!"}
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

function Row({ l, r }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
      <span style={{ color: "#64748b" }}>{l}</span><span>{r}</span>
    </div>
  );
}
