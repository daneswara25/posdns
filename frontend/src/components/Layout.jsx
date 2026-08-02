import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Package, Tags, Warehouse, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, ShoppingCart, Sun, Moon, LogOut, Menu, X, Store,
  UserCircle, Truck, ClipboardList, ShoppingBag,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["Owner", "Manager", "Kasir", "Gudang"], end: true },
  { to: "/produk", label: "Produk", icon: Package, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/kategori", label: "Kategori", icon: Tags, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/inventory", label: "Inventory", icon: Warehouse, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/pelanggan", label: "Pelanggan", icon: UserCircle, roles: ["Owner", "Manager", "Kasir"] },
  { to: "/pesanan", label: "Pesanan", icon: ShoppingBag, roles: ["Owner", "Manager", "Kasir"] },
  { to: "/supplier", label: "Supplier", icon: Truck, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/pembelian", label: "Pembelian", icon: ClipboardList, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/laporan", label: "Laporan", icon: BarChart3, roles: ["Owner", "Manager"] },
  { to: "/pengguna", label: "Pengguna", icon: UsersIcon, roles: ["Owner", "Manager"] },
  { to: "/pengaturan", label: "Pengaturan", icon: SettingsIcon, roles: ["Owner", "Manager"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user?.role));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed z-40 h-full w-64 shrink-0 border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">KasirCloud</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              data-testid={`nav-${n.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <n.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-border p-4">
          <Button
            onClick={() => navigate("/pos")}
            className="w-full gap-2 font-semibold"
            data-testid="open-pos-button"
          >
            <ShoppingCart className="h-4 w-4" /> Buka Kasir POS
          </Button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="menu-toggle">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selamat datang</p>
              <p className="font-display text-sm font-semibold">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline-block">
              {user?.role}
            </span>
            <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-button">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
