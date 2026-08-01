from dotenv import load_dotenv
from pathlib import Path
import os

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


class SaleInput(BaseModel):
    items: List[SaleItem]
    discount: float = 0
    tax_rate: float = 0
    payment_method: Literal["Tunai", "Kartu", "QRIS", "E-Wallet"]
    paid_amount: float = 0
    customer_name: Optional[str] = ""


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
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], "name": data.name, "color": data.color, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    return clean(doc)


@api_router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    await db.categories.update_one({"id": cid, "tenant_id": user["tenant_id"]}, {"$set": {"name": data.name, "color": data.color}})
    return {"ok": True}


@api_router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("Owner", "Manager"))):
    await db.categories.delete_one({"id": cid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Products ----------
@api_router.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    return await db.products.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.post("/products")
async def create_product(data: ProductInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang"))):
    doc = {"id": new_id(), "tenant_id": user["tenant_id"], **data.model_dump(), "created_at": now_iso()}
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
    doc = {
        "id": new_id(), "tenant_id": user["tenant_id"], "invoice": invoice,
        "items": [i.model_dump() for i in data.items], "subtotal": subtotal,
        "discount": data.discount, "tax_rate": data.tax_rate, "tax": taxed,
        "total": total, "cost": total_cost, "profit": (subtotal - data.discount) - total_cost,
        "payment_method": data.payment_method, "paid_amount": data.paid_amount,
        "change": max(0, data.paid_amount - total), "customer_name": data.customer_name,
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


@api_router.get("/")
async def root():
    return {"message": "Cloud POS API"}


app.include_router(api_router)

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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
