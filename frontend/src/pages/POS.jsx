import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { rupiah, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, X, ArrowLeft, ShoppingCart, ScanLine, CheckCircle2 } from "lucide-react";

const METHODS = ["Tunai", "Kartu", "QRIS", "E-Wallet"];

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState({});

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
    api.get("/settings").then((r) => {
      setSettings(r.data || {});
      setTaxRate(r.data?.tax_rate || 0);
    });
  };
  useEffect(load, []);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.active !== false &&
          (cat === "all" || p.category_id === cat) &&
          (p.name.toLowerCase().includes(q.toLowerCase()) ||
            (p.barcode || "").includes(q) ||
            (p.sku || "").toLowerCase().includes(q.toLowerCase()))
      ),
    [products, q, cat]
  );

  const addToCart = (p) => {
    setCart((c) => {
      const ex = c.find((x) => x.product_id === p.id);
      if (ex) return c.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { product_id: p.id, name: p.name, price: p.price, cost: p.cost || 0, qty: 1 }];
    });
  };
  const setQty = (id, delta) =>
    setCart((c) =>
      c.map((x) => (x.product_id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
    );
  const removeItem = (id) => setCart((c) => c.filter((x) => x.product_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const taxAmt = ((subtotal - discount) * taxRate) / 100;
  const total = Math.max(0, subtotal - discount + taxAmt);
  const change = Math.max(0, Number(paid || 0) - total);

  const openPay = () => {
    if (cart.length === 0) return toast.error("Keranjang masih kosong");
    setPaid(method === "Tunai" ? "" : String(total));
    setPayOpen(true);
  };

  const submitPay = async () => {
    if (method === "Tunai" && Number(paid) < total)
      return toast.error("Nominal bayar kurang");
    try {
      const { data } = await api.post("/sales", {
        items: cart,
        discount: Number(discount) || 0,
        tax_rate: taxRate,
        payment_method: method,
        paid_amount: method === "Tunai" ? Number(paid) : total,
      });
      setReceipt(data);
      setPayOpen(false);
      setCart([]);
      setDiscount(0);
      setPaid("");
      load();
      toast.success("Transaksi berhasil");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const printReceipt = (r) => {
    const line = (l, rr) => `<div class="row"><span>${l}</span><span>${rr}</span></div>`;
    const items = r.items
      .map((i) => line(`${i.qty}x ${i.name}`, rupiah(i.price * i.qty)))
      .join("");
    const html = `<!DOCTYPE html><html><head><title>${r.invoice}</title>
<style>
  * { font-family: 'Courier New', monospace; font-size: 12px; }
  body { width: 280px; margin: 0 auto; padding: 8px; color: #000; }
  h2 { text-align: center; font-size: 14px; margin: 4px 0; }
  p.sub { text-align: center; margin: 0; font-size: 11px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .bold { font-weight: bold; }
  .center { text-align: center; }
</style></head><body>
  <h2>${settings.business_name || "KasirCloud"}</h2>
  ${settings.address ? `<p class="sub">${settings.address}</p>` : ""}
  ${settings.phone ? `<p class="sub">${settings.phone}</p>` : ""}
  <div class="divider"></div>
  <div class="row"><span>${r.invoice}</span></div>
  <div class="row"><span>${new Date(r.created_at).toLocaleString("id-ID")}</span></div>
  <div class="row"><span>Kasir: ${r.cashier || ""}</span></div>
  <div class="divider"></div>
  ${items}
  <div class="divider"></div>
  ${line("Subtotal", rupiah(r.subtotal))}
  ${line("Diskon", "-" + rupiah(r.discount))}
  ${line(`Pajak (${r.tax_rate}%)`, rupiah(r.tax))}
  <div class="row bold"><span>TOTAL</span><span>${rupiah(r.total)}</span></div>
  ${line(r.payment_method, rupiah(r.paid_amount))}
  ${line("Kembalian", rupiah(r.change))}
  <div class="divider"></div>
  <p class="center">${settings.receipt_footer || "Terima kasih telah berbelanja!"}</p>
</body></html>`;
    const w = window.open("", "PRINT", "width=320,height=600");
    if (!w) {
      toast.error("Popup diblokir browser. Izinkan popup untuk mencetak.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="pos-back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-display text-lg font-bold">Kasir POS</span>
        </div>
        <span className="text-sm text-muted-foreground">{user?.name} · {user?.role}</span>
      </div>

      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-12">
        {/* products */}
        <div className="flex flex-col overflow-hidden lg:col-span-8">
          <div className="border-b border-border p-4">
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Scan barcode atau cari produk..."
                className="h-12 pl-11"
                data-testid="pos-search-input"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setCat("all")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${cat === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                data-testid="pos-category-all"
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${cat === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  data-testid={`pos-product-${p.id}`}
                  className="flex flex-col rounded-lg border border-border bg-card p-3 text-left transition-colors duration-200 hover:border-primary disabled:opacity-40"
                >
                  <div className="mb-2 flex h-20 items-center justify-center rounded-md bg-secondary">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full rounded-md object-cover" />
                    ) : (
                      <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                  <p className="mt-1 font-display font-bold text-primary">{rupiah(p.price)}</p>
                  <p className="text-xs text-muted-foreground">Stok: {p.stock}</p>
                </motion.button>
              ))}
              {filtered.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Tidak ada produk.</p>}
            </div>
          </div>
        </div>

        {/* cart */}
        <div className="flex flex-col border-l border-border bg-card lg:col-span-4">
          <div className="border-b border-border p-4">
            <h3 className="font-display text-lg font-semibold">Keranjang</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence>
              {cart.length === 0 && <p className="text-sm text-muted-foreground">Belum ada item.</p>}
              {cart.map((i) => (
                <motion.div
                  key={i.product_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="mb-3 rounded-md border border-border p-3"
                  data-testid={`cart-item-${i.product_id}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium">{i.name}</p>
                    <button onClick={() => removeItem(i.product_id)} className="text-destructive" data-testid={`cart-remove-${i.product_id}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(i.product_id, -1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`cart-minus-${i.product_id}`}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                      <button onClick={() => setQty(i.product_id, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`cart-plus-${i.product_id}`}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-display text-sm font-bold">{rupiah(i.price * i.qty)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Diskon (Rp)</Label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="h-9"
                data-testid="pos-discount-input"
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{rupiah(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Diskon</span><span>-{rupiah(discount)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Pajak ({taxRate}%)</span><span>{rupiah(taxAmt)}</span></div>
              <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><span>Total</span><span data-testid="pos-total">{rupiah(total)}</span></div>
            </div>
            <Button onClick={openPay} className="mt-4 h-14 w-full text-base font-bold" data-testid="pos-pay-button">
              Bayar
            </Button>
          </div>
        </div>
      </div>

      {/* payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Pembayaran — {rupiah(total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Metode Pembayaran</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMethod(m); setPaid(m === "Tunai" ? "" : String(total)); }}
                    className={`rounded-md border py-3 text-sm font-semibold transition-colors duration-200 ${method === m ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
                    data-testid={`pay-method-${m}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {method === "Tunai" && (
              <div>
                <Label>Nominal Diterima</Label>
                <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 h-12 text-lg" data-testid="pay-cash-input" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[total, 50000, 100000, 200000].map((v, idx) => (
                    <button key={idx} onClick={() => setPaid(String(v))} className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">
                      {rupiah(v)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm">Kembalian: <span className="font-bold">{rupiah(change)}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitPay} className="h-12 w-full text-base font-bold" data-testid="pay-confirm-button">
              Konfirmasi & Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
        <DialogContent data-testid="receipt-dialog">
          {receipt && (
            <div>
              <div className="mb-3 flex flex-col items-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="mt-2 font-display text-lg font-bold">Pembayaran Berhasil</p>
              </div>
              <div className="rounded-md border border-dashed border-border p-4 font-mono text-xs">
                <p className="text-center font-bold">{receipt.invoice}</p>
                <div className="my-2 border-t border-dashed" />
                {receipt.items.map((i) => (
                  <div key={i.product_id} className="flex justify-between">
                    <span>{i.qty}x {i.name}</span>
                    <span>{rupiah(i.price * i.qty)}</span>
                  </div>
                ))}
                <div className="my-2 border-t border-dashed" />
                <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(receipt.subtotal)}</span></div>
                <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(receipt.discount)}</span></div>
                <div className="flex justify-between"><span>Pajak</span><span>{rupiah(receipt.tax)}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(receipt.total)}</span></div>
                <div className="flex justify-between"><span>{receipt.payment_method}</span><span>{rupiah(receipt.paid_amount)}</span></div>
                <div className="flex justify-between"><span>Kembalian</span><span>{rupiah(receipt.change)}</span></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => printReceipt(receipt)} data-testid="receipt-print-button">Cetak</Button>
                <Button className="flex-1" onClick={() => setReceipt(null)} data-testid="receipt-close-button">Transaksi Baru</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
