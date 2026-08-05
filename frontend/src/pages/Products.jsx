import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { NumberInput } from "@/components/NumberInput";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";

const EMPTY = { name: "", sku: "", barcode: "", category_id: "", price: "", cost: "", stock: "", min_stock: 5, unit: "pcs", image: "", active: true };

export default function Products() {
  const { user } = useAuth();
  const canEdit = ["Owner", "Manager", "Gudang"].includes(user?.role);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useViewMode("view-products", "list");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCats(r.data));
  };
  useEffect(load, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...p, category_id: p.category_id || "" }); setEditId(p.id); setOpen(true); };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let { width, height } = img;
        if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.5);
        setForm((f) => ({ ...f, image: compressed }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const save = async () => {
    if (!form.name || form.price === "") return toast.error("Nama dan harga wajib diisi");
    const payload = {
      ...form,
      category_id: form.category_id || null,
      price: Number(form.price), cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0,
    };
    try {
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post("/products", payload);
      toast.success("Produk disimpan");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus produk ini?")) return;
    await api.delete(`/products/${id}`);
    toast.success("Produk dihapus");
    load();
  };

  const catName = (id) => cats.find((c) => c.id === id)?.name || "-";
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Master Data</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Produk</h1>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="gap-2" data-testid="add-product-button">
            <Plus className="h-4 w-4" /> Tambah Produk
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk..." className="pl-10" data-testid="product-search" />
        </div>
        <ViewToggle mode={view} onChange={setView} />
      </div>

      {view === "list" && (
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Produk</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-right">Harga</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border" data-testid={`product-row-${p.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                      {p.image ? <img src={p.image} alt="" className="h-full w-full rounded-md object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku || p.barcode || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{catName(p.category_id)}</td>
                <td className="px-4 py-3 text-right font-medium">{rupiah(p.price)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={p.stock <= p.min_stock ? "font-semibold text-orange-600" : ""}>{p.stock} {p.unit}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(p.id)} data-testid={`delete-product-${p.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Belum ada produk.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {view !== "list" && (
        <div className={`grid gap-3 ${view === "besar" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}`} data-testid="product-grid">
          {filtered.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card" data-testid={`product-card-${p.id}`}>
              <div className="aspect-square w-full overflow-hidden bg-secondary">
                {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
              </div>
              <div className={`flex flex-1 flex-col ${view === "besar" ? "p-3" : "p-2"}`}>
                <p className={`truncate font-medium ${view === "besar" ? "text-sm" : "text-xs"}`}>{p.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{catName(p.category_id)}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`font-display font-bold text-primary ${view === "besar" ? "text-sm" : "text-xs"}`}>{rupiah(p.price)}</span>
                  <span className={`text-[11px] ${p.stock <= p.min_stock ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>{p.stock} {p.unit}</span>
                </div>
                {canEdit && (
                  <div className="mt-2 flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 flex-1 px-2" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="outline" size="sm" className="h-7 flex-1 px-2" onClick={() => del(p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Belum ada produk.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={() => { document.body.style.pointerEvents = ""; }} data-testid="product-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit Produk" : "Tambah Produk"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nama Produk</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" />
            </div>
            <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} data-testid="product-barcode-input" /></div>
            <div className="col-span-2 space-y-1">
              <Label>Kategori</Label>
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="product-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa kategori</SelectItem>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Harga Jual</Label><NumberInput value={form.price} onValueChange={(v) => setForm({ ...form, price: v })} data-testid="product-price-input" /></div>
            <div className="space-y-1"><Label>Harga Modal <span className="text-muted-foreground">(opsional)</span></Label><NumberInput value={form.cost} onValueChange={(v) => setForm({ ...form, cost: v })} placeholder="Boleh dikosongkan" /></div>
            <div className="space-y-1"><Label>Stok</Label><NumberInput value={form.stock} onValueChange={(v) => setForm({ ...form, stock: v })} data-testid="product-stock-input" /></div>
            <div className="space-y-1"><Label>Min. Stok</Label><NumberInput value={form.min_stock} onValueChange={(v) => setForm({ ...form, min_stock: v })} /></div>
            <div className="space-y-1"><Label>Satuan</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="col-span-2 space-y-2">
              <Label>Gambar Produk <span className="text-muted-foreground">(otomatis dikompres)</span></Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                  {form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Kosong</span>}
                </div>
                <div className="flex-1 space-y-1">
                  <Input type="file" accept="image/*" onChange={handleImage} data-testid="product-image-input" />
                  {form.image && <button type="button" onClick={() => setForm({ ...form, image: "" })} className="text-xs text-destructive">Hapus gambar</button>}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} className="w-full" data-testid="save-product-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
