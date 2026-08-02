import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, PackageCheck, Trash2, ClipboardList } from "lucide-react";

export default function Purchases() {
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);

  const load = () => {
    api.get("/purchases").then((r) => setList(r.data));
    api.get("/suppliers").then((r) => setSuppliers(r.data));
    api.get("/products").then((r) => setProducts(r.data));
  };
  useEffect(load, []);

  const addItem = () => setItems([...items, { product_id: "", name: "", qty: 1, cost: 0 }]);
  const setItem = (idx, patch) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const total = items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.cost || 0), 0);

  const save = async () => {
    const valid = items.filter((i) => i.product_id && i.qty > 0);
    if (valid.length === 0) return toast.error("Tambahkan minimal 1 item");
    try {
      await api.post("/purchases", {
        supplier_id: supplierId || null,
        supplier_name: suppliers.find((s) => s.id === supplierId)?.name || "",
        items: valid.map((i) => ({ product_id: i.product_id, name: products.find((p) => p.id === i.product_id)?.name || "", qty: Number(i.qty), cost: Number(i.cost) })),
        note,
      });
      toast.success("PO dibuat");
      setOpen(false); setItems([]); setSupplierId(""); setNote(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const receive = async (id) => {
    if (!window.confirm("Terima barang? Stok akan bertambah otomatis.")) return;
    try { await api.post(`/purchases/${id}/receive`); toast.success("Barang diterima, stok diperbarui"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pembelian</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Purchase Order</h1>
        </div>
        <Button onClick={() => { setItems([{ product_id: "", name: "", qty: 1, cost: 0 }]); setOpen(true); }} className="gap-2" data-testid="add-po-button"><Plus className="h-4 w-4" /> Buat PO</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left">No. PO</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((po) => (
              <tr key={po.id} className="border-t border-border" data-testid={`po-row-${po.id}`}>
                <td className="px-4 py-3 font-medium">{po.po_number}</td>
                <td className="px-4 py-3 text-muted-foreground">{po.supplier_name || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{rupiah(po.total)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${po.status === "Diterima" ? "bg-emerald-500/15 text-emerald-600" : "bg-orange-500/15 text-orange-600"}`}>{po.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {po.status !== "Diterima" && <Button size="sm" variant="outline" className="gap-1" onClick={() => receive(po.id)} data-testid={`receive-po-${po.id}`}><PackageCheck className="h-4 w-4" /> Terima</Button>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Belum ada PO.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="po-dialog">
          <DialogHeader><DialogTitle className="font-display">Buat Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger data-testid="po-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Item</Label><Button size="sm" variant="ghost" onClick={addItem} data-testid="po-add-item"><Plus className="h-4 w-4" /></Button></div>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-6">
                    <Select value={it.product_id} onValueChange={(v) => setItem(idx, { product_id: v, cost: products.find((p) => p.id === v)?.cost || 0 })}>
                      <SelectTrigger data-testid={`po-item-product-${idx}`}><SelectValue placeholder="Produk" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input type="number" placeholder="Qty" value={it.qty} onChange={(e) => setItem(idx, { qty: e.target.value })} data-testid={`po-item-qty-${idx}`} /></div>
                  <div className="col-span-3"><Input type="number" placeholder="Modal" value={it.cost} onChange={(e) => setItem(idx, { cost: e.target.value })} /></div>
                  <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
              ))}
            </div>
            <div className="space-y-1"><Label>Catatan</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="flex justify-between font-display text-lg font-bold"><span>Total</span><span>{rupiah(total)}</span></div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-po-button">Simpan PO</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
