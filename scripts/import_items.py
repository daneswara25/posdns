import os, csv, io, uuid, urllib.request
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

owner = db.users.find_one({"username": os.environ["OWNER_USERNAME"].lower().strip()})
tid = owner["tenant_id"]

url = "https://customer-assets-eiarnc6j.emergentagent.net/job_smart-checkout-cloud/artifacts/zm1jmc24_export_items.csv"
data = urllib.request.urlopen(url).read().decode("utf-8")
rows = list(csv.DictReader(io.StringIO(data)))

def num(v):
    try:
        return float(str(v).replace(",", "").strip())
    except Exception:
        return None

# ensure categories
cat_cache = {}
def get_cat(name):
    if not name:
        return None
    if name in cat_cache:
        return cat_cache[name]
    existing = db.categories.find_one({"tenant_id": tid, "name": name})
    if existing:
        cat_cache[name] = existing["id"]
    else:
        cid = str(uuid.uuid4())
        db.categories.insert_one({"id": cid, "tenant_id": tid, "name": name, "color": "#2563EB", "created_at": datetime.now(timezone.utc).isoformat()})
        cat_cache[name] = cid
    return cat_cache[name]

now = datetime.now(timezone.utc).isoformat()
current = None
docs = []
for r in rows:
    nm = (r.get("Name") or "").strip()
    if nm:
        current = nm
    if not current:
        continue
    opt = (r.get("Option 1 value") or "").strip()
    full = f"{current} - {opt}" if opt else current
    cost = num(r.get("Cost")) or 0
    price = num(r.get("Price [DANESWARA PRINTING]"))
    if price is None:
        price = cost if cost else 0
    sku = (r.get("SKU") or "").strip()
    barcode = (r.get("Barcode") or "").strip()
    docs.append({
        "id": str(uuid.uuid4()), "tenant_id": tid, "name": full, "sku": sku,
        "barcode": barcode, "category_id": get_cat(current), "price": price,
        "cost": cost, "stock": 100, "min_stock": 5, "unit": "pcs",
        "image": "", "active": True, "created_at": now,
    })

if docs:
    db.products.insert_many(docs)
print("inserted", len(docs), "products;", len(cat_cache), "categories")
