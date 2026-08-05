import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { rupiah, formatApiError } from "@/lib/api";
import { printReceiptSmart } from "@/lib/printer";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, X, ArrowLeft, ShoppingCart, ScanLine, CheckCircle2, PauseCircle, PlayCircle, HandCoins, Copy, MessageCircle, UserPlus, Check, ChevronsUpDown } from "lucide-react";

const METHODS = ["Tunai", "Kartu", "QRIS", "E-Wallet"];

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [variantCat, setVariantCat] = useState(null);
  const [custOpen, setCustOpen] = useState(false);
  const [variantNote, setVariantNote] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [waPhone, setWaPhone] = useState("");
  const [settings, setSettings] = useState({});
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [held, setHeld] = useState([]);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmt, setDepositAmt] = useState("");

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
    api.get("/settings").then((r) => {
      setSettings(r.data || {});
      setTaxRate(r.data?.tax_rate || 0);
    });
    api.get("/customers").then((r) => setCustomers(r.data));
    api.get("/held-orders").then((r) => setHeld(r.data));
  };
  useEffect(load, []);

  const holdOrder = async () => {
    if (cart.length === 0) return toast.error("Keranjang kosong");
    const label = window.prompt("Label pesanan (mis. Order Budi / Antrian 3):", `Order ${held.length + 1}`);
    if (!label) return;
    await api.post("/held-orders", { label, items: cart, discount: Number(discount) || 0 });
    setCart([]); setDiscount(0);
    api.get("/held-orders").then((r) => setHeld(r.data));
    toast.success("Pesanan ditahan");
  };
  const resumeOrder = async (h) => {
    setCart((h.items || []).map((i) => ({ ...i, note: i.note || "", lineId: i.lineId || `${i.product_id}|${i.note || ""}` })));
    setDiscount(h.discount || 0);
    await api.delete(`/held-orders/${h.id}`);
    api.get("/held-orders").then((r) => setHeld(r.data));
    toast.success(`Melanjutkan ${h.label}`);
  };
  const submitDeposit = async () => {
    if (cart.length === 0) return toast.error("Keranjang kosong");
    try {
      await api.post("/orders", {
        customer_id: customerId || null, items: cart,
        discount: Number(discount) || 0, tax_rate: taxRate,
        deposit_amount: Number(depositAmt) || 0, deposit_method: method,
      });
      toast.success("Pesanan + deposit tersimpan");
      setDepositOpen(false); setDepositAmt(""); setCart([]); setDiscount(0); setCustomerId("");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const searching = q.trim().length > 0;
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.active !== false &&
          (p.name.toLowerCase().includes(q.toLowerCase()) ||
            (p.barcode || "").includes(q) ||
            (p.sku || "").toLowerCase().includes(q.toLowerCase()))
      ),
    [products, q]
  );

  // Group products by category to show category tiles (main products) with variants
  const productsByCat = useMemo(() => {
    const m = {};
    products.forEach((p) => {
      if (p.active === false) return;
      const k = p.category_id || "none";
      (m[k] = m[k] || []).push(p);
    });
    return m;
  }, [products]);

  const catTiles = useMemo(() => {
    const list = categories
      .filter((c) => (productsByCat[c.id] || []).length > 0)
      .map((c) => ({ ...c, items: productsByCat[c.id] }));
    if ((productsByCat["none"] || []).length > 0) {
      list.push({ id: "none", name: "Tanpa Kategori", items: productsByCat["none"] });
    }
    return list;
  }, [categories, productsByCat]);

  const tileThumb = (tile) =>
    tile.image || tile.items.find((p) => p.image)?.image || null;

  const stripVariant = (name, catName) => {
    if (!catName) return name;
    const pref = `${catName} - `;
    return name.startsWith(pref) ? name.slice(pref.length) : name;
  };

  const addToCart = (p, note = "") => {
    const lineId = `${p.id}|${note}`;
    setCart((c) => {
      const ex = c.find((x) => x.lineId === lineId);
      if (ex) return c.map((x) => (x.lineId === lineId ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { lineId, product_id: p.id, name: p.name, price: p.price, cost: p.cost || 0, qty: 1, note }];
    });
  };
  const setQty = (lineId, delta) =>
    setCart((c) =>
      c.map((x) => (x.lineId === lineId ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
    );
  const removeItem = (lineId) => setCart((c) => c.filter((x) => x.lineId !== lineId));

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
        customer_id: customerId || null,
      });
      setPayOpen(false);
      setCart([]);
      setDiscount(0);
      setPaid("");
      setCustomerId("");
      load();
      toast.success("Transaksi berhasil");
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        setReceipt(data);
        setWaPhone(data.customer_phone || "");
      }, 300);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const printReceipt = async (r) => {
    try {
      const mode = await printReceiptSmart(r, settings);
      if (mode === "bluetooth") toast.success("Struk dikirim ke printer Bluetooth");
    } catch (e) {
      toast.error(e.message || "Gagal mencetak struk");
    }
  };

  const buildBillText = (r) => {
    const lines = [];
    lines.push(`*${settings.business_name || "Daneswara POS"}*`);
    if (settings.address) lines.push(settings.address);
    if (settings.phone) lines.push(`Telp: ${settings.phone}`);
    lines.push("--------------------------------");
    lines.push(`No   : ${r.invoice}`);
    lines.push(`Tgl  : ${new Date(r.created_at).toLocaleString("id-ID")}`);
    if (r.customer_name) lines.push(`Nama : ${r.customer_name}`);
    lines.push("--------------------------------");
    r.items.forEach((i) => {
      lines.push(`${i.qty} x ${i.name}`);
      lines.push(`     @${rupiah(i.price)}  =  ${rupiah(i.price * i.qty)}`);
      if (i.note) lines.push(`     * ${i.note}`);
    });
    lines.push("--------------------------------");
    lines.push(`Subtotal : ${rupiah(r.subtotal)}`);
    if (r.discount) lines.push(`Diskon   : -${rupiah(r.discount)}`);
    if (r.tax) lines.push(`Pajak    : ${rupiah(r.tax)}`);
    lines.push(`*TOTAL   : ${rupiah(r.total)}*`);
    lines.push(`Bayar (${r.payment_method}) : ${rupiah(r.paid_amount)}`);
    if (r.change) lines.push(`Kembali  : ${rupiah(r.change)}`);
    lines.push("--------------------------------");
    lines.push(settings.receipt_footer || "Terima kasih telah berbelanja!");
    return lines.join("\n");
  };

  const normalizePhone = (p) => {
    let d = (p || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    if (d.startsWith("0")) d = "62" + d.slice(1);
    else if (d.startsWith("62")) { /* ok */ }
    else if (d.startsWith("8")) d = "62" + d;
    return d;
  };

  const sendWhatsApp = (r) => {
    const text = buildBillText(r);
    const phone = normalizePhone(waPhone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    if (!phone) toast.info("Nomor tujuan kosong — pilih kontak di WhatsApp");
  };

  const saveWaCustomer = async () => {
    if (!waPhone.trim()) return toast.error("Isi nomor WhatsApp dulu");
    const name = window.prompt("Nama pelanggan baru:", receipt?.customer_name || "");
    if (!name || !name.trim()) return;
    try {
      await api.post("/customers", { name: name.trim(), phone: waPhone.trim() });
      toast.success("Pelanggan baru tersimpan");
      api.get("/customers").then((r) => setCustomers(r.data));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const copyBill = async (r) => {
    const text = buildBillText(r);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Struk disalin — tinggal tempel di WhatsApp pelanggan");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Struk disalin");
    }
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
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {searching ? (
              /* Direct product search results (barcode / name) */
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => addToCart(p)}
                    data-testid={`pos-product-${p.id}`}
                    className="flex flex-col rounded-lg border border-border bg-card p-3 text-left transition-colors duration-200 hover:border-primary"
                  >
                    <div className="mb-2 aspect-square overflow-hidden rounded-md bg-secondary flex items-center justify-center">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                    <p className="mt-1 font-display font-bold text-primary">{rupiah(p.price)}</p>
                    <p className={`text-xs ${p.stock <= 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>Stok: {p.stock}</p>
                  </motion.button>
                ))}
                {filtered.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Tidak ada produk.</p>}
              </div>
            ) : (
              /* Category tiles (main products) — variants shown after tapping */
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {catTiles.map((tile) => {
                  const thumb = tileThumb(tile);
                  return (
                    <motion.button
                      key={tile.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { setVariantCat(tile); setVariantNote(""); }}                      data-testid={`pos-cat-tile-${tile.id}`}
                      className="group relative flex aspect-square flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors duration-200 hover:border-primary"
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                        {thumb ? (
                          <img src={thumb} alt={tile.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-display text-3xl font-bold text-muted-foreground">{tile.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1.5 backdrop-blur-sm">
                        <p className="line-clamp-2 text-center text-xs font-semibold text-white">{tile.name}</p>
                      </div>
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{tile.items.length}</span>
                    </motion.button>
                  );
                })}
                {catTiles.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Belum ada produk.</p>}
              </div>
            )}
          </div>
        </div>

        {/* cart */}
        <div className="flex flex-col border-l border-border bg-card lg:col-span-4">
          <div className="space-y-2 border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Keranjang</h3>
              <Button variant="outline" size="sm" className="gap-1" onClick={holdOrder} data-testid="pos-hold-button"><PauseCircle className="h-4 w-4" /> Tahan</Button>
            </div>
            <Popover open={custOpen} onOpenChange={setCustOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-9 w-full justify-between font-normal" data-testid="pos-customer-select">
                  <span className="truncate">
                    {customerId ? (customers.find((c) => c.id === customerId)?.name || "Pelanggan") : "Pilih pelanggan (opsional)"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari nama / nomor..." data-testid="pos-customer-search" />
                  <CommandList>
                    <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                    <CommandItem
                      value="tanpa pelanggan"
                      onSelect={() => { setCustomerId(""); setCustOpen(false); }}
                      data-testid="pos-customer-none"
                    >
                      <Check className={`mr-2 h-4 w-4 ${!customerId ? "opacity-100" : "opacity-0"}`} />
                      Tanpa pelanggan
                    </CommandItem>
                    {customers.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.phone || ""}`}
                        onSelect={() => { setCustomerId(c.id); setCustOpen(false); }}
                        data-testid={`pos-customer-option-${c.id}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${customerId === c.id ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{c.name}{c.phone ? ` · ${c.phone}` : ""}</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {held.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {held.map((h) => (
                  <button key={h.id} onClick={() => resumeOrder(h)} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent" data-testid={`resume-${h.id}`}>
                    <PlayCircle className="h-3.5 w-3.5" /> {h.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence>
              {cart.length === 0 && <p className="text-sm text-muted-foreground">Belum ada item.</p>}
              {cart.map((i) => (
                <motion.div
                  key={i.lineId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="mb-3 rounded-md border border-border p-3"
                  data-testid={`cart-item-${i.product_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{i.name}</p>
                      {i.note && <p className="mt-0.5 text-xs italic text-muted-foreground">📝 {i.note}</p>}
                    </div>
                    <button onClick={() => removeItem(i.lineId)} className="text-destructive" data-testid={`cart-remove-${i.product_id}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(i.lineId, -1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`cart-minus-${i.product_id}`}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                      <button onClick={() => setQty(i.lineId, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`cart-plus-${i.product_id}`}>
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
            <Button onClick={() => { if (cart.length === 0) return toast.error("Keranjang kosong"); setDepositAmt(""); setDepositOpen(true); }} variant="outline" className="mt-2 h-11 w-full gap-2 font-semibold" data-testid="pos-deposit-button">
              <HandCoins className="h-4 w-4" /> Pesanan + Deposit (DP)
            </Button>
          </div>
        </div>
      </div>

      {/* variant picker dialog */}
      <Dialog open={!!variantCat} onOpenChange={(o) => { if (!o) { setVariantCat(null); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-lg" onCloseAutoFocus={() => { document.body.style.pointerEvents = ""; }} data-testid="variant-dialog">
          <DialogHeader className="shrink-0 border-b border-border px-5 pb-3 pt-5">
            <DialogTitle className="font-display">{variantCat?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">Pilih varian untuk ditambahkan ke keranjang</p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-2">
              {variantCat?.items.map((p) => {
                const inCart = cart.find((x) => x.product_id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p, variantNote.trim())}
                    data-testid={`variant-item-${p.id}`}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-secondary flex items-center justify-center">
                      {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <ShoppingCart className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{stripVariant(p.name, variantCat?.name)}</p>
                      <p className={`text-xs ${p.stock <= 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>Stok: {p.stock}{p.stock <= 0 ? " (minus)" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-primary">{rupiah(p.price)}</p>
                      {inCart && <span className="text-[10px] font-semibold text-emerald-600">{inCart.qty} di keranjang</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 border-t border-border px-5 py-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Catatan (muncul di struk)</label>
            <textarea
              value={variantNote}
              onChange={(e) => setVariantNote(e.target.value)}
              placeholder="cth: Sablon logo depan, ukuran L, warna hitam..."
              rows={2}
              data-testid="variant-note-input"
              className="mb-3 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mb-3 text-[11px] text-muted-foreground">Catatan ini akan menempel pada varian yang Anda tambahkan setelahnya.</p>
            <Button variant="outline" className="w-full" onClick={() => setVariantCat(null)} data-testid="variant-done-button">Selesai</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>        <DialogContent data-testid="payment-dialog">
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

      {/* deposit dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent data-testid="deposit-dialog">
          <DialogHeader><DialogTitle className="font-display">Pesanan Custom — Total {rupiah(total)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Simpan pesanan dengan uang muka. Sisa dilunasi saat pesanan selesai (menu Pesanan).</p>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Metode Deposit</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={`rounded-md border py-3 text-sm font-semibold transition-colors duration-200 ${method === m ? "border-primary bg-accent text-accent-foreground" : "border-border"}`} data-testid={`deposit-method-${m}`}>{m}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nominal Deposit (DP)</Label>
              <Input type="number" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} className="h-12 text-lg" data-testid="deposit-amount-input" />
              <p className="text-sm">Sisa tagihan: <span className="font-bold">{rupiah(Math.max(0, total - Number(depositAmt || 0)))}</span></p>
            </div>
          </div>
          <DialogFooter><Button onClick={submitDeposit} className="h-12 w-full font-bold" data-testid="deposit-confirm-button">Simpan Pesanan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) { setReceipt(null); document.body.style.pointerEvents = ""; } }}>
        <DialogContent data-testid="receipt-dialog">
          <DialogHeader className="sr-only"><DialogTitle>Pembayaran Berhasil</DialogTitle></DialogHeader>
          {receipt && (
            <div>
              <div className="mb-3 flex flex-col items-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="mt-2 font-display text-lg font-bold">Pembayaran Berhasil</p>
              </div>
              <div className="rounded-md border border-dashed border-border p-4 font-mono text-xs">
                <p className="text-center font-bold">{receipt.invoice}</p>
                <div className="my-2 border-t border-dashed" />
                {receipt.items.map((i, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between">
                      <span>{i.qty}x {i.name}</span>
                      <span>{rupiah(i.price * i.qty)}</span>
                    </div>
                    {i.note && <p className="pl-2 italic text-muted-foreground">* {i.note}</p>}
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
              <div className="mt-4 space-y-2">
                <div className="space-y-1 text-left">
                  <label className="text-xs text-muted-foreground">Nomor WhatsApp pelanggan</label>
                  <Input
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="cth: 08123456789"
                    inputMode="tel"
                    data-testid="receipt-wa-phone-input"
                  />
                  {waPhone.trim() && !receipt.customer_id && (
                    <button
                      type="button"
                      onClick={saveWaCustomer}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      data-testid="receipt-save-customer-button"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Simpan sebagai pelanggan baru
                    </button>
                  )}
                </div>
                <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" onClick={() => sendWhatsApp(receipt)} data-testid="receipt-whatsapp-button">
                  <MessageCircle className="h-4 w-4" /> Kirim Struk via WhatsApp
                </Button>
                <Button variant="secondary" className="w-full gap-2" onClick={() => copyBill(receipt)} data-testid="receipt-copy-button">
                  <Copy className="h-4 w-4" /> Salin Struk
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => printReceipt(receipt)} data-testid="receipt-print-button">Cetak</Button>
                  <Button className="flex-1" onClick={() => { setReceipt(null); document.body.style.pointerEvents = ""; }} data-testid="receipt-close-button">Transaksi Baru</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
