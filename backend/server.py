from dotenv import load_dotenv
from pathlib import Path
import os
import json
import csv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, tenant_id: str, role: str) -> str:
    payload = {
        "sub": user_id, "tid": tenant_id, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if roles and user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran Anda")
        return user
    return checker


async def log_activity(tenant_id: str, user: dict, action: str, detail: str):
    await db.activities.insert_one({
        "id": new_id(), "tenant_id": tenant_id, "user_id": user["id"],
        "user_name": user.get("name", ""), "action": action, "detail": detail,
        "created_at": now_iso(),
    })


# ---------- Models ----------
class LoginInput(BaseModel):
    username: str
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: Literal["Owner", "Manager", "Kasir", "Gudang"]


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["Owner", "Manager", "Kasir", "Gudang"]] = None
    password: Optional[str] = None
    active: Optional[bool] = None


class CategoryInput(BaseModel):
    name: str
    color: Optional[str] = "#2563EB"
    image: Optional[str] = ""


class ProductInput(BaseModel):
    name: str
    sku: Optional[str] = ""
    barcode: Optional[str] = ""
    category_id: Optional[str] = None
    price: float
    cost: float = 0
    stock: int = 0
    min_stock: int = 5
    unit: Optional[str] = "pcs"
    image: Optional[str] = ""
    active: bool = True


class SaleItem(BaseModel):
    product_id: str
    name: str
    price: float
    qty: int
    cost: float = 0
    note: Optional[str] = ""


class SaleInput(BaseModel):
    items: List[SaleItem]
    discount: float = 0
    tax_rate: float = 0
    payment_method: Literal["Tunai", "Kartu", "QRIS", "E-Wallet"]
    paid_amount: float = 0
    customer_name: Optional[str] = ""
    customer_id: Optional[str] = None
    order_id: Optional[str] = None


class StockInput(BaseModel):
    product_id: str
    type: Literal["Masuk", "Keluar", "Penyesuaian", "Opname"]
    qty: int
    note: Optional[str] = ""


class SettingsInput(BaseModel):
    business_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    receipt_footer: Optional[str] = None
    logo: Optional[str] = None
    print_mode: Optional[str] = None
    paper_width: Optional[str] = None
    printers: Optional[list] = None
    active_printer: Optional[str] = None


class CustomerInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""


class SupplierInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""


class POItem(BaseModel):
    product_id: str
    name: str
    qty: int
    cost: float = 0


class PurchaseOrderInput(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    items: List[POItem]
    note: Optional[str] = ""


class HeldOrderInput(BaseModel):
    label: str
    items: List[SaleItem]
    discount: float = 0


class CustomOrderInput(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = ""
    items: List[SaleItem]
    discount: float = 0
    tax_rate: float = 0
    deposit_amount: float = 0
    deposit_method: Literal["Tunai", "Kartu", "QRIS", "E-Wallet"] = "Tunai"
    note: Optional[str] = ""


class SettleOrderInput(BaseModel):
    payment_method: Literal["Tunai", "Kartu", "QRIS", "E-Wallet"]
    paid_amount: float = 0


# ---------- Auth ----------
@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    user = await db.users.find_one({"username": data.username.lower().strip()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    token = create_access_token(user["id"], user["tenant_id"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    user = clean(user)
    user.pop("password_hash", None)
    return {"user": user, "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordInput, user: dict = Depends(get_current_user)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    record = await db.users.find_one({"id": user["id"]})
    if not record or not verify_password(data.current_password, record["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"ok": True}


# ---------- Users (Owner/Manager) ----------
@api_router.get("/users")
async def list_users(user: dict = Depends(require_roles("Owner", "Manager"))):
    users = await db.users.find({"tenant_id": user["tenant_id"]}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@api_router.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(require_roles("Owner", "Manager"))):
    uname = data.username.lower().strip()
    if await db.users.find_one({"username": uname}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    doc = {
        "id": new_id(), "tenant_id": user["tenant_id"], "username": uname,
        "password_hash": hash_password(data.password), "name": data.name,
        "role": data.role, "active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await log_activity(user["tenant_id"], user, "Tambah Pengguna", f"{data.name} ({data.role})")
    return clean({**doc, "password_hash": None})


@api_router.put("/users/{uid}")
async def update_user(uid: str, data: UserUpdate, user: dict = Depends(require_roles("Owner", "Manager"))):
    target = await db.users.find_one({"id": uid, "tenant_id": user["tenant_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    upd = {}
    if data.name is not None:
        upd["name"] = data.name
    if data.role is not None:
        upd["role"] = data.role
    if data.active is not None:
        upd["active"] = data.active
    if data.password:
        upd["password_hash"] = hash_password(data.password)
    await db.users.update_one({"id": uid}, {"$set": upd})
    return {"ok": True}


@api_router.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("Owner"))):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")
    await db.users.delete_one({"id": uid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Categories ----------
@api_router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    return await db.categories.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(500)


@api_router.post("/categories")
async def create_category(data: CategoryInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], "name": data.name, "color": data.color, "image": data.image or "", "created_at": now_iso()}
    await db.categories.insert_one(doc)
    return clean(doc)


@api_router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    await db.categories.update_one({"id": cid, "tenant_id": user["tenant_id"]}, {"$set": {"name": data.name, "color": data.color, "image": data.image or ""}})
    return {"ok": True}


@api_router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.categories.delete_one({"id": cid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Products ----------
@api_router.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    prods = await db.products.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(2000)
    prods.sort(key=lambda p: (p.get("sort_order") if p.get("sort_order") is not None else 10**9, (p.get("name") or "").lower()))
    return prods


class ReorderInput(BaseModel):
    ids: list


@api_router.post("/products/reorder")
async def reorder_products(data: ReorderInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    for idx, pid in enumerate(data.ids):
        await db.products.update_one({"id": pid, "tenant_id": user["tenant_id"]}, {"$set": {"sort_order": idx}})
    await log_activity(user["tenant_id"], user, "Atur Urutan Produk", f"{len(data.ids)} produk diurutkan ulang")
    return {"ok": True, "count": len(data.ids)}


@api_router.post("/products")
async def create_product(data: ProductInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    count = await db.products.count_documents({"tenant_id": user["tenant_id"]})
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], **data.model_dump(), "sort_order": count, "created_at": now_iso()}
    await db.products.insert_one(doc)
    await log_activity(user["tenant_id"], user, "Tambah Produk", data.name)
    return clean(doc)


@api_router.put("/products/{pid}")
async def update_product(pid: str, data: ProductInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    res = await db.products.update_one({"id": pid, "tenant_id": user["tenant_id"]}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"ok": True}


@api_router.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.products.delete_one({"id": pid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Inventory ----------
@api_router.post("/stock")
async def adjust_stock(data: StockInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    product = await db.products.find_one({"id": data.product_id, "tenant_id": user["tenant_id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    before = product.get("stock", 0)
    if data.type == "Masuk":
        after = before + data.qty
    elif data.type == "Keluar":
        after = before - data.qty
    elif data.type == "Opname":
        after = data.qty
    else:  # Penyesuaian
        after = before + data.qty
    await db.products.update_one({"id": data.product_id}, {"$set": {"stock": after}})
    mv = {
        "id": new_id(), "tenant_id": user["tenant_id"], "product_id": data.product_id,
        "product_name": product["name"], "type": data.type, "qty": data.qty,
        "before": before, "after": after, "note": data.note,
        "user_name": user.get("name", ""), "created_at": now_iso(),
    }
    await db.stock_movements.insert_one(mv)
    await log_activity(user["tenant_id"], user, f"Stok {data.type}", f"{product['name']}: {before} -> {after}")
    return clean(mv)


@api_router.get("/stock/movements")
async def stock_movements(user: dict = Depends(get_current_user)):
    return await db.stock_movements.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ---------- Sales / POS ----------
@api_router.post("/sales")
async def create_sale(data: SaleInput, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")
    subtotal = sum(i.price * i.qty for i in data.items)
    total_cost = sum(i.cost * i.qty for i in data.items)
    taxed = (subtotal - data.discount) * (data.tax_rate / 100)
    total = subtotal - data.discount + taxed
    # decrement stock
    for i in data.items:
        prod = await db.products.find_one({"id": i.product_id, "tenant_id": user["tenant_id"]})
        if prod:
            before = prod.get("stock", 0)
            after = before - i.qty
            await db.products.update_one({"id": i.product_id}, {"$set": {"stock": after}})
            await db.stock_movements.insert_one({
                "id": new_id(), "tenant_id": user["tenant_id"], "product_id": i.product_id,
                "product_name": i.name, "type": "Keluar", "qty": i.qty, "before": before,
                "after": after, "note": "Penjualan POS", "user_name": user.get("name", ""), "created_at": now_iso(),
            })
    count = await db.sales.count_documents({"tenant_id": user["tenant_id"]})
    invoice = f"INV-{datetime.now().strftime('%y%m%d')}-{count + 1:04d}"
    cust_name = data.customer_name
    cust_phone = ""
    if data.customer_id:
        cust = await db.customers.find_one({"id": data.customer_id, "tenant_id": user["tenant_id"]})
        if cust:
            cust_name = cust["name"]
            cust_phone = cust.get("phone", "") or ""
            await db.customers.update_one(
                {"id": data.customer_id},
                {"$inc": {"total_spent": total, "visits": 1}},
            )
    doc = {
        "id": new_id(), "tenant_id": user["tenant_id"], "invoice": invoice,
        "items": [i.model_dump() for i in data.items], "subtotal": subtotal,
        "discount": data.discount, "tax_rate": data.tax_rate, "tax": taxed,
        "total": total, "cost": total_cost, "profit": (subtotal - data.discount) - total_cost,
        "payment_method": data.payment_method, "paid_amount": data.paid_amount,
        "change": max(0, data.paid_amount - total), "customer_name": cust_name,
        "customer_id": data.customer_id, "customer_phone": cust_phone,
        "cashier": user.get("name", ""), "cashier_id": user["id"], "created_at": now_iso(),
    }
    await db.sales.insert_one(doc)
    await log_activity(user["tenant_id"], user, "Transaksi Penjualan", f"{invoice} - Rp{total:,.0f}")
    return clean(doc)


@api_router.get("/sales")
async def list_sales(user: dict = Depends(get_current_user), limit: int = Query(100)):
    return await db.sales.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@api_router.post("/sales/{sid}/refund")
async def refund_sale(sid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    sale = await db.sales.find_one({"id": sid, "tenant_id": user["tenant_id"]})
    if not sale:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if sale.get("refunded"):
        raise HTTPException(status_code=400, detail="Transaksi sudah di-refund")
    for i in sale["items"]:
        prod = await db.products.find_one({"id": i["product_id"], "tenant_id": user["tenant_id"]})
        if prod:
            await db.products.update_one({"id": i["product_id"]}, {"$set": {"stock": prod.get("stock", 0) + i["qty"]}})
    await db.sales.update_one({"id": sid}, {"$set": {"refunded": True, "refunded_at": now_iso()}})
    await log_activity(user["tenant_id"], user, "Refund", sale["invoice"])
    return {"ok": True}


# ---------- Dashboard & Reports ----------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    tid = user["tenant_id"]
    sales = await db.sales.find({"tenant_id": tid, "refunded": {"$ne": True}}, {"_id": 0}).to_list(5000)
    today = datetime.now(timezone.utc).date().isoformat()
    today_sales = [s for s in sales if s["created_at"][:10] == today]
    total_revenue = sum(s["total"] for s in sales)
    today_revenue = sum(s["total"] for s in today_sales)
    today_profit = sum(s.get("profit", 0) for s in today_sales)
    products = await db.products.find({"tenant_id": tid}, {"_id": 0}).to_list(2000)
    low_stock = [p for p in products if p.get("stock", 0) <= p.get("min_stock", 5)]
    minus_stock = [p for p in products if p.get("stock", 0) < 0]
    # last 7 days
    series = []
    for d in range(6, -1, -1):
        day = (datetime.now(timezone.utc).date() - timedelta(days=d)).isoformat()
        day_total = sum(s["total"] for s in sales if s["created_at"][:10] == day)
        series.append({"date": day[5:], "total": day_total})
    # top products
    prod_qty = {}
    for s in sales:
        for i in s["items"]:
            prod_qty[i["name"]] = prod_qty.get(i["name"], 0) + i["qty"]
    top = sorted(prod_qty.items(), key=lambda x: -x[1])[:5]
    top_products = [{"name": n, "qty": q} for n, q in top]
    activities = await db.activities.find({"tenant_id": tid}, {"_id": 0}).sort("created_at", -1).to_list(8)
    return {
        "today_revenue": today_revenue, "today_transactions": len(today_sales),
        "today_profit": today_profit, "total_revenue": total_revenue,
        "total_transactions": len(sales), "product_count": len(products),
        "low_stock_count": len(low_stock), "low_stock": low_stock[:10],
        "minus_stock_count": len(minus_stock), "minus_stock": minus_stock[:20],
        "sales_series": series, "top_products": top_products, "activities": activities,
    }


@api_router.get("/reports/sales")
async def report_sales(user: dict = Depends(require_roles("Owner", "Manager")),
                       start: Optional[str] = None, end: Optional[str] = None):
    tid = user["tenant_id"]
    q = {"tenant_id": tid, "refunded": {"$ne": True}}
    sales = await db.sales.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    if start:
        sales = [s for s in sales if s["created_at"][:10] >= start]
    if end:
        sales = [s for s in sales if s["created_at"][:10] <= end]
    total = sum(s["total"] for s in sales)
    profit = sum(s.get("profit", 0) for s in sales)
    by_method = {}
    for s in sales:
        by_method[s["payment_method"]] = by_method.get(s["payment_method"], 0) + s["total"]
    return {
        "count": len(sales), "total": total, "profit": profit,
        "by_method": [{"method": k, "total": v} for k, v in by_method.items()],
        "sales": sales,
    }


@api_router.get("/reports/monthly")
async def report_monthly(user: dict = Depends(require_roles("Owner", "Manager")),
                         year: int = Query(...)):
    tid = user["tenant_id"]
    sales = await db.sales.find({"tenant_id": tid, "refunded": {"$ne": True}}, {"_id": 0}).to_list(20000)
    months = [{"month": m, "total": 0, "profit": 0, "count": 0} for m in range(1, 13)]
    prefix = f"{year}-"
    for s in sales:
        created = s.get("created_at", "")
        if not created.startswith(prefix):
            continue
        try:
            m = int(created[5:7])
        except (ValueError, IndexError):
            continue
        if 1 <= m <= 12:
            months[m - 1]["total"] += s["total"]
            months[m - 1]["profit"] += s.get("profit", 0)
            months[m - 1]["count"] += 1
    return {"year": year, "months": months}


@api_router.post("/admin/clear-transactions")
async def clear_transactions(user: dict = Depends(require_roles("Owner"))):
    tid = user["tenant_id"]
    result = {}
    for coll in ["sales", "orders", "held_orders", "activities", "stock_movements", "expenses"]:
        r = await db[coll].delete_many({"tenant_id": tid})
        result[coll] = r.deleted_count
    await log_activity(tid, user, "Reset Data Transaksi", "Semua transaksi percobaan dihapus")
    return {"ok": True, "deleted": result}


def _parse_catalog_num(v):
    v = (v or "").strip().lower()
    if not v or v == "variable":
        return 0.0
    try:
        return float(v.replace(".", "").replace(",", ""))
    except ValueError:
        return 0.0


@api_router.post("/admin/reprice-catalog")
async def reprice_catalog(user: dict = Depends(require_roles("Owner"))):
    """Match products by SKU against the bundled catalog CSV and overwrite price & cost.
    Price column 'variable'/empty -> 0 (manual price at POS). Cost <- 'Cost'."""
    tid = user["tenant_id"]
    csv_path = Path(__file__).parent / "data" / "export_items.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=400, detail="File katalog tidak ditemukan di server")
    price_map = {}
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = (row.get("SKU") or "").strip()
            if not sku:
                continue
            price_map[sku] = {
                "price": _parse_catalog_num(row.get("Price [DANESWARA PRINTING]")),
                "cost": _parse_catalog_num(row.get("Cost")),
            }
    products = await db.products.find({"tenant_id": tid}).to_list(10000)
    matched = 0
    unmatched = []
    for p in products:
        sku = (p.get("sku") or "").strip()
        m = price_map.get(sku)
        if m:
            matched += 1
            await db.products.update_one({"id": p["id"]}, {"$set": {"price": m["price"], "cost": m["cost"]}})
        else:
            unmatched.append(p.get("name") or sku or "?")
    await log_activity(tid, user, "Cocokkan Katalog", f"{matched} produk diperbarui harga & biaya dari katalog")
    return {"ok": True, "catalog_rows": len(price_map), "products": len(products), "matched": matched, "unmatched_count": len(unmatched), "unmatched": unmatched[:30]}


@api_router.post("/admin/reset-stock")
async def reset_stock(user: dict = Depends(require_roles("Owner"))):
    """Set stock = 0 for all products in the tenant."""
    tid = user["tenant_id"]
    r = await db.products.update_many({"tenant_id": tid}, {"$set": {"stock": 0}})
    await log_activity(tid, user, "Reset Stok", f"Stok {r.modified_count} produk di-reset ke 0")
    return {"ok": True, "reset": r.modified_count}


# ---------- Expenses & Profit-Loss ----------
EXPENSE_CATEGORIES = [
    "Pembelian Bahan DTF", "Pembelian ATK", "Biaya Operasional",
    "Jasa Pengambilan Online", "Pembelian Lain-lain",
]


class ExpenseInput(BaseModel):
    category: str
    amount: float
    note: Optional[str] = ""
    date: Optional[str] = None


@api_router.get("/expense-categories")
async def expense_categories(user: dict = Depends(get_current_user)):
    return EXPENSE_CATEGORIES


@api_router.get("/expenses")
async def list_expenses(user: dict = Depends(require_roles("Owner", "Manager")),
                        start: Optional[str] = None, end: Optional[str] = None):
    tid = user["tenant_id"]
    items = await db.expenses.find({"tenant_id": tid}, {"_id": 0}).sort("date", -1).to_list(5000)
    if start:
        items = [e for e in items if (e.get("date") or "")[:10] >= start]
    if end:
        items = [e for e in items if (e.get("date") or "")[:10] <= end]
    return items


@api_router.post("/expenses")
async def create_expense(data: ExpenseInput, user: dict = Depends(require_roles("Owner", "Manager"))):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Nominal harus lebih dari 0")
    doc = {
        "id": new_id(), "tenant_id": user["tenant_id"], "category": data.category,
        "amount": data.amount, "note": data.note or "",
        "date": (data.date or now_iso())[:10] if data.date else now_iso()[:10],
        "user_name": user.get("name", ""), "created_at": now_iso(),
    }
    await db.expenses.insert_one(doc)
    await log_activity(user["tenant_id"], user, "Tambah Pengeluaran", f"{data.category} - {data.amount}")
    return clean(doc)


@api_router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.expenses.delete_one({"id": eid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


@api_router.get("/reports/profit-loss")
async def report_profit_loss(user: dict = Depends(require_roles("Owner", "Manager")),
                             start: Optional[str] = None, end: Optional[str] = None):
    tid = user["tenant_id"]
    sales = await db.sales.find({"tenant_id": tid, "refunded": {"$ne": True}}, {"_id": 0}).to_list(20000)
    if start:
        sales = [s for s in sales if s["created_at"][:10] >= start]
    if end:
        sales = [s for s in sales if s["created_at"][:10] <= end]
    revenue = sum(s["total"] for s in sales)
    hpp = sum(s.get("cost", 0) for s in sales)

    expenses = await db.expenses.find({"tenant_id": tid}, {"_id": 0}).to_list(5000)
    if start:
        expenses = [e for e in expenses if (e.get("date") or "")[:10] >= start]
    if end:
        expenses = [e for e in expenses if (e.get("date") or "")[:10] <= end]
    by_cat = {}
    for e in expenses:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]
    expense_total = sum(e["amount"] for e in expenses)

    return {
        "revenue": revenue,
        "hpp": hpp,
        "gross_profit": revenue - hpp,
        "expense_total": expense_total,
        "expenses_by_category": [{"category": k, "amount": v} for k, v in by_cat.items()],
        "net_profit": revenue - expense_total,
        "sales_count": len(sales),
        "expense_count": len(expenses),
    }


# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    return s or {}


@api_router.put("/settings")
async def update_settings(data: SettingsInput, user: dict = Depends(require_roles("Owner", "Manager"))):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({"tenant_id": user["tenant_id"]}, {"$set": upd}, upsert=True)
    return {"ok": True}


# ---------- Customers / Membership ----------
@api_router.get("/customers")
async def list_customers(user: dict = Depends(get_current_user)):
    return await db.customers.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.post("/customers")
async def create_customer(data: CustomerInput, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], **data.model_dump(),
           "total_spent": 0, "visits": 0, "created_at": now_iso()}
    await db.customers.insert_one(doc)
    return clean(doc)


@api_router.put("/customers/{cid}")
async def update_customer(cid: str, data: CustomerInput, user: dict = Depends(get_current_user)):
    await db.customers.update_one({"id": cid, "tenant_id": user["tenant_id"]}, {"$set": data.model_dump()})
    return {"ok": True}


@api_router.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.customers.delete_one({"id": cid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


@api_router.get("/customers/{cid}/history")
async def customer_history(cid: str, user: dict = Depends(get_current_user)):
    return await db.sales.find({"tenant_id": user["tenant_id"], "customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ---------- Suppliers ----------
@api_router.get("/suppliers")
async def list_suppliers(user: dict = Depends(get_current_user)):
    return await db.suppliers.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/suppliers")
async def create_supplier(data: SupplierInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], **data.model_dump(), "created_at": now_iso()}
    await db.suppliers.insert_one(doc)
    return clean(doc)


@api_router.put("/suppliers/{sid}")
async def update_supplier(sid: str, data: SupplierInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    await db.suppliers.update_one({"id": sid, "tenant_id": user["tenant_id"]}, {"$set": data.model_dump()})
    return {"ok": True}


@api_router.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.suppliers.delete_one({"id": sid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Purchase Orders ----------
@api_router.get("/purchases")
async def list_purchases(user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    return await db.purchases.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/purchases")
async def create_purchase(data: PurchaseOrderInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    if not data.items:
        raise HTTPException(status_code=400, detail="Item pembelian kosong")
    total = sum(i.qty * i.cost for i in data.items)
    count = await db.purchases.count_documents({"tenant_id": user["tenant_id"]})
    doc = {
        "id": new_id(), "tenant_id": user["tenant_id"], "po_number": f"PO-{datetime.now().strftime('%y%m%d')}-{count + 1:04d}",
        "supplier_id": data.supplier_id, "supplier_name": data.supplier_name,
        "items": [i.model_dump() for i in data.items], "total": total, "note": data.note,
        "status": "Menunggu", "cashier": user.get("name", ""), "created_at": now_iso(),
    }
    await db.purchases.insert_one(doc)
    await log_activity(user["tenant_id"], user, "Buat PO", f"{doc['po_number']} - Rp{total:,.0f}")
    return clean(doc)


@api_router.post("/purchases/{pid}/receive")
async def receive_purchase(pid: str, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    po = await db.purchases.find_one({"id": pid, "tenant_id": user["tenant_id"]})
    if not po:
        raise HTTPException(status_code=404, detail="PO tidak ditemukan")
    if po.get("status") == "Diterima":
        raise HTTPException(status_code=400, detail="PO sudah diterima")
    for i in po["items"]:
        prod = await db.products.find_one({"id": i["product_id"], "tenant_id": user["tenant_id"]})
        if prod:
            before = prod.get("stock", 0)
            after = before + i["qty"]
            await db.products.update_one({"id": i["product_id"]}, {"$set": {"stock": after, "cost": i.get("cost", prod.get("cost", 0))}})
            await db.stock_movements.insert_one({
                "id": new_id(), "tenant_id": user["tenant_id"], "product_id": i["product_id"],
                "product_name": i["name"], "type": "Masuk", "qty": i["qty"], "before": before,
                "after": after, "note": f"Penerimaan {po['po_number']}", "user_name": user.get("name", ""), "created_at": now_iso(),
            })
    await db.purchases.update_one({"id": pid}, {"$set": {"status": "Diterima", "received_at": now_iso()}})
    await log_activity(user["tenant_id"], user, "Terima Barang", po["po_number"])
    return {"ok": True}


# ---------- Held Orders (Hold) ----------
@api_router.get("/held-orders")
async def list_held(user: dict = Depends(get_current_user)):
    return await db.held_orders.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/held-orders")
async def create_held(data: HeldOrderInput, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], "label": data.label,
           "items": [i.model_dump() for i in data.items], "discount": data.discount,
           "cashier": user.get("name", ""), "created_at": now_iso()}
    await db.held_orders.insert_one(doc)
    return clean(doc)


@api_router.delete("/held-orders/{hid}")
async def delete_held(hid: str, user: dict = Depends(get_current_user)):
    await db.held_orders.delete_one({"id": hid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Custom Orders with Deposit ----------
@api_router.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    return await db.orders.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/orders")
async def create_order(data: CustomOrderInput, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Item pesanan kosong")
    subtotal = sum(i.price * i.qty for i in data.items)
    taxed = (subtotal - data.discount) * (data.tax_rate / 100)
    total = subtotal - data.discount + taxed
    cust_name = data.customer_name
    if data.customer_id:
        c = await db.customers.find_one({"id": data.customer_id, "tenant_id": user["tenant_id"]})
        if c:
            cust_name = c["name"]
    count = await db.orders.count_documents({"tenant_id": user["tenant_id"]})
    doc = {
        "id": new_id(), "tenant_id": user["tenant_id"], "order_number": f"ORD-{datetime.now().strftime('%y%m%d')}-{count + 1:04d}",
        "customer_id": data.customer_id, "customer_name": cust_name,
        "items": [i.model_dump() for i in data.items], "subtotal": subtotal,
        "discount": data.discount, "tax_rate": data.tax_rate, "tax": taxed, "total": total,
        "deposit_amount": data.deposit_amount, "deposit_method": data.deposit_method,
        "remaining": max(0, total - data.deposit_amount), "note": data.note,
        "status": "Proses", "cashier": user.get("name", ""), "created_at": now_iso(),
    }
    await db.orders.insert_one(doc)
    await log_activity(user["tenant_id"], user, "Pesanan Custom + Deposit", f"{doc['order_number']} DP Rp{data.deposit_amount:,.0f}")
    return clean(doc)


@api_router.post("/orders/{oid}/complete")
async def complete_order(oid: str, data: SettleOrderInput, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": oid, "tenant_id": user["tenant_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if order.get("status") == "Selesai":
        raise HTTPException(status_code=400, detail="Pesanan sudah selesai")
    remaining = max(0, order["total"] - order.get("deposit_amount", 0))
    if data.paid_amount < remaining:
        raise HTTPException(status_code=400, detail="Nominal pelunasan kurang dari sisa tagihan")
    # decrement stock now (order fulfilled)
    for i in order["items"]:
        prod = await db.products.find_one({"id": i["product_id"], "tenant_id": user["tenant_id"]})
        if prod:
            before = prod.get("stock", 0)
            after = before - i["qty"]
            await db.products.update_one({"id": i["product_id"]}, {"$set": {"stock": after}})
            await db.stock_movements.insert_one({
                "id": new_id(), "tenant_id": user["tenant_id"], "product_id": i["product_id"],
                "product_name": i["name"], "type": "Keluar", "qty": i["qty"], "before": before,
                "after": after, "note": f"Pesanan {order['order_number']}", "user_name": user.get("name", ""), "created_at": now_iso(),
            })
    total_cost = sum(i.get("cost", 0) * i["qty"] for i in order["items"])
    count = await db.sales.count_documents({"tenant_id": user["tenant_id"]})
    invoice = f"INV-{datetime.now().strftime('%y%m%d')}-{count + 1:04d}"
    if order.get("customer_id"):
        await db.customers.update_one({"id": order["customer_id"]},
                                      {"$inc": {"total_spent": order["total"], "visits": 1}})
    sale = {
        "id": new_id(), "tenant_id": user["tenant_id"], "invoice": invoice,
        "items": order["items"], "subtotal": order["subtotal"], "discount": order["discount"],
        "tax_rate": order["tax_rate"], "tax": order["tax"], "total": order["total"],
        "cost": total_cost, "profit": (order["subtotal"] - order["discount"]) - total_cost,
        "payment_method": data.payment_method, "paid_amount": data.paid_amount + order["deposit_amount"],
        "change": max(0, (data.paid_amount + order["deposit_amount"]) - order["total"]),
        "customer_name": order["customer_name"], "customer_id": order.get("customer_id"),
        "from_order": order["order_number"],
        "cashier": user.get("name", ""), "cashier_id": user["id"], "created_at": now_iso(),
    }
    await db.sales.insert_one(sale)
    await db.orders.update_one({"id": oid}, {"$set": {"status": "Selesai", "completed_at": now_iso(), "invoice": invoice}})
    await log_activity(user["tenant_id"], user, "Pesanan Selesai", f"{order['order_number']} -> {invoice}")
    return clean(sale)


@api_router.delete("/orders/{oid}")
async def delete_order(oid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.orders.delete_one({"id": oid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "Cloud POS API"}


app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "healthy"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.products.create_index([("tenant_id", 1)])
    await db.sales.create_index([("tenant_id", 1)])
    # seed owner + tenant
    owner_username = os.environ["OWNER_USERNAME"].lower().strip()
    existing = await db.users.find_one({"username": owner_username})
    if not existing:
        # Migrate an existing owner (older username) to the env super-admin credentials
        old_owner = await db.users.find_one({"role": "Owner"})
        if old_owner:
            await db.users.update_one(
                {"id": old_owner["id"]},
                {"$set": {"username": owner_username, "password_hash": hash_password(os.environ["OWNER_PASSWORD"])}},
            )
            logger.info(f"Migrated super-admin to username '{owner_username}'")
        else:
            tenant_id = new_id()
            await db.tenants.insert_one({
                "id": tenant_id, "name": os.environ.get("OWNER_BUSINESS", "Bisnis Saya"), "created_at": now_iso(),
            })
            await db.users.insert_one({
                "id": new_id(), "tenant_id": tenant_id, "username": owner_username,
                "password_hash": hash_password(os.environ["OWNER_PASSWORD"]),
                "name": os.environ.get("OWNER_NAME", "Owner"), "role": "Owner",
                "active": True, "created_at": now_iso(),
            })
            await db.settings.insert_one({
                "tenant_id": tenant_id, "business_name": os.environ.get("OWNER_BUSINESS", "Bisnis Saya"),
                "address": "", "phone": "", "currency": "Rp", "tax_rate": 11.0,
                "receipt_footer": "Terima kasih telah berbelanja!",
            })
            logger.info("Seeded owner account")

    # Seed customers from bundled CSV export if none exist yet (for fresh production DB)
    owner = await db.users.find_one({"username": owner_username})
    if owner:
        tid = owner["tenant_id"]
        cust_count = await db.customers.count_documents({"tenant_id": tid})
        if cust_count == 0:
            seed_path = ROOT_DIR / "seed_customers.json"
            if seed_path.exists():
                try:
                    with open(seed_path, "r", encoding="utf-8") as f:
                        seed_customers = json.load(f)
                    now = now_iso()
                    docs = [{
                        "id": new_id(), "tenant_id": tid, "name": c.get("name", ""),
                        "phone": c.get("phone", ""), "email": c.get("email", ""),
                        "address": c.get("address", ""), "visits": int(c.get("visits", 0)),
                        "total_spent": float(c.get("total_spent", 0)), "created_at": now,
                    } for c in seed_customers if c.get("name")]
                    if docs:
                        await db.customers.insert_many(docs)
                        logger.info(f"Seeded {len(docs)} customers from seed_customers.json")
                except Exception as e:
                    logger.error(f"Customer seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
