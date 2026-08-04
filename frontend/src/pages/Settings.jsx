import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Store, Save, Printer, Bluetooth, Trash2, AlertTriangle, Monitor, TestTube2 } from "lucide-react";
import {
  connectBluetoothPrinter, disconnectPrinter, isPrinterConnected, getPrinterName,
  bluetoothSupported, printReceiptSmart,
} from "@/lib/printer";

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState({ business_name: "", address: "", phone: "", currency: "Rp", tax_rate: 0, receipt_footer: "", print_mode: "desktop" });
  const [btName, setBtName] = useState(getPrinterName());
  const [connecting, setConnecting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setForm((f) => ({ ...f, ...r.data, print_mode: r.data?.print_mode || "desktop" })));
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    try {
      await api.put("/settings", { ...form, tax_rate: Number(form.tax_rate) });
      toast.success("Pengaturan disimpan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const connectBt = async () => {
    setConnecting(true);
    try {
      const name = await connectBluetoothPrinter();
      setBtName(name);
      toast.success(`Terhubung ke ${name}`);
    } catch (e) {
      if (e.name !== "NotFoundError") toast.error(e.message || "Gagal menghubungkan printer");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectBt = () => { disconnectPrinter(); setBtName(""); toast.info("Printer diputus"); };

  const testPrint = async () => {
    const sample = {
      invoice: "TEST-0001",
      created_at: new Date().toISOString(),
      cashier: user?.name || "Kasir",
      items: [
        { name: "Contoh Produk A", qty: 1, price: 25000 },
        { name: "Contoh Produk B", qty: 2, price: 15000 },
      ],
      subtotal: 55000, discount: 5000, tax_rate: 0, tax: 0, total: 50000,
      payment_method: "Tunai", paid_amount: 50000, change: 0,
    };
    try {
      await printReceiptSmart(sample, form);
      toast.success("Tes cetak dikirim");
    } catch (e) {
      toast.error(e.message || "Gagal mencetak");
    }
  };

  const doReset = async () => {
    setResetting(true);
    try {
      const r = await api.post("/admin/clear-transactions");
      const d = r.data.deleted || {};
      toast.success(`Data transaksi dihapus (${d.sales || 0} penjualan, ${d.orders || 0} pesanan)`);
      setConfirmReset(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Konfigurasi</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pengaturan</h1>
      </div>

      {/* Outlet info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Informasi Outlet</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>Nama Bisnis</Label><Input value={form.business_name || ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="settings-business-input" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Alamat</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1"><Label>Telepon</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>Mata Uang</Label><Input value={form.currency || ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div className="space-y-1"><Label>Pajak Default (%)</Label><Input type="number" value={form.tax_rate ?? 0} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} data-testid="settings-tax-input" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Footer Struk</Label><Input value={form.receipt_footer || ""} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} /></div>
        </div>
        <Button onClick={save} className="mt-6 gap-2" data-testid="save-settings-button"><Save className="h-4 w-4" /> Simpan Perubahan</Button>
      </div>

      {/* Printer settings */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Pengaturan Printer</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Mode Cetak Struk</Label>
            <Select value={form.print_mode} onValueChange={(v) => setForm({ ...form, print_mode: v })}>
              <SelectTrigger data-testid="print-mode-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desktop"><span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Desktop / USB (dialog print)</span></SelectItem>
                <SelectItem value="bluetooth"><span className="flex items-center gap-2"><Bluetooth className="h-4 w-4" /> Bluetooth Thermal (58mm)</span></SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.print_mode === "bluetooth"
                ? "Mode Bluetooth: butuh Chrome di Android/Windows & printer BLE. Tidak berfungsi di iPhone/Safari."
                : "Mode Desktop: mencetak lewat dialog print browser (printer USB/biasa). Berfungsi di semua perangkat."}
            </p>
          </div>

          {form.print_mode === "bluetooth" && (
            <div className="rounded-md border border-border bg-secondary/40 p-4">
              {!bluetoothSupported() ? (
                <p className="flex items-center gap-2 text-sm text-amber-600" data-testid="bt-unsupported">
                  <AlertTriangle className="h-4 w-4" /> Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome (Android/Windows).
                </p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm">Status printer:</span>
                    <span className={`text-sm font-semibold ${btName ? "text-emerald-600" : "text-muted-foreground"}`} data-testid="bt-status">
                      {btName ? `Terhubung · ${btName}` : "Belum terhubung"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={connectBt} disabled={connecting} className="gap-2" data-testid="bt-connect-button">
                      <Bluetooth className="h-4 w-4" /> {connecting ? "Menghubungkan..." : btName ? "Hubungkan Ulang" : "Hubungkan Printer"}
                    </Button>
                    {btName && <Button variant="outline" onClick={disconnectBt} data-testid="bt-disconnect-button">Putuskan</Button>}
                  </div>
                </>
              )}
            </div>
          )}

          <Button variant="outline" onClick={testPrint} className="gap-2" data-testid="test-print-button">
            <TestTube2 className="h-4 w-4" /> Cetak Tes
          </Button>
          <p className="text-xs text-muted-foreground">Simpan perubahan agar mode cetak dipakai di seluruh aplikasi.</p>
          <Button onClick={save} className="gap-2" data-testid="save-printer-button"><Save className="h-4 w-4" /> Simpan Mode Cetak</Button>
        </div>
      </div>

      {/* Danger zone — Owner only */}
      {user?.role === "Owner" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6" data-testid="danger-zone">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-display text-lg font-semibold text-destructive">Zona Berbahaya</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Hapus semua data transaksi percobaan (penjualan, pesanan, hold order, riwayat aktivitas & mutasi stok). Data produk & pelanggan tidak dihapus. Tindakan ini tidak dapat dibatalkan.
          </p>
          <Button variant="destructive" onClick={() => setConfirmReset(true)} className="gap-2" data-testid="reset-transactions-button">
            <Trash2 className="h-4 w-4" /> Reset Data Transaksi
          </Button>
        </div>
      )}

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent data-testid="reset-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Hapus semua transaksi percobaan?</DialogTitle>
            <DialogDescription>
              Semua penjualan, pesanan, hold order, aktivitas, dan mutasi stok akan dihapus permanen. Produk & pelanggan tetap aman.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Batal</Button>
            <Button variant="destructive" onClick={doReset} disabled={resetting} data-testid="reset-confirm-button">
              {resetting ? "Menghapus..." : "Ya, Hapus Semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
