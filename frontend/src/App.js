import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Inventory from "@/pages/Inventory";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Orders from "@/pages/Orders";
import Expenses from "@/pages/Expenses";
import OtherIncome from "@/pages/OtherIncome";
import ExportData from "@/pages/ExportData";

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/pos"
                element={
                  <ProtectedRoute>
                    <POS />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="produk" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Products /></ProtectedRoute>} />
                <Route path="kategori" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Categories /></ProtectedRoute>} />
                <Route path="inventory" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Inventory /></ProtectedRoute>} />
                <Route path="pelanggan" element={<ProtectedRoute roles={["Owner", "Manager", "Kasir"]}><Customers /></ProtectedRoute>} />
                <Route path="pesanan" element={<ProtectedRoute roles={["Owner", "Manager", "Kasir"]}><Orders /></ProtectedRoute>} />
                <Route path="supplier" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Suppliers /></ProtectedRoute>} />
                <Route path="pembelian" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Purchases /></ProtectedRoute>} />
                <Route path="pengeluaran" element={<ProtectedRoute roles={["Owner", "Manager"]}><Expenses /></ProtectedRoute>} />
                <Route path="pendapatan-lain" element={<ProtectedRoute roles={["Owner", "Manager"]}><OtherIncome /></ProtectedRoute>} />
                <Route path="laporan" element={<ProtectedRoute roles={["Owner", "Manager"]}><Reports /></ProtectedRoute>} />
                <Route path="ekspor" element={<ProtectedRoute roles={["Owner"]}><ExportData /></ProtectedRoute>} />
                <Route path="pengguna" element={<ProtectedRoute roles={["Owner", "Manager"]}><Users /></ProtectedRoute>} />
                <Route path="pengaturan" element={<ProtectedRoute roles={["Owner", "Manager"]}><Settings /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
