import os, csv, io, uuid, urllib.request
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

owner = db.users.find_one({"username": os.environ["OWNER_USERNAME"].lower().strip()})
tid = owner["tenant_id"]

url = "https://customer-assets-lxgj4vgw.emergentagent.net/job_777d652c-8daf-49a9-a912-a4ce0c287726/artifacts/b6aws91p_customers-2026-08-04.csv"
data = urllib.request.urlopen(url).read().decode("utf-8-sig")
rows = list(csv.DictReader(io.StringIO(data)))
print("CSV rows:", len(rows))

def num(v):
    try:
        return float(str(v).replace(",", "").replace(".", "").strip())
    except Exception:
        return 0

def clean(v):
    return (v or "").strip()

# wipe existing customers for this tenant (full replace)
res = db.customers.delete_many({"tenant_id": tid})
print("Deleted existing customers:", res.deleted_count)

now = datetime.now(timezone.utc).isoformat()
docs = []
skipped = 0
for r in rows:
    name = clean(r.get("Nama Pelanggan"))
    if not name:
        skipped += 1
        continue
    docs.append({
        "id": str(uuid.uuid4()),
        "tenant_id": tid,
        "name": name,
        "phone": clean(r.get("Telepon")),
        "email": clean(r.get("Email")),
        "address": clean(r.get("Alamat")),
        "visits": int(num(r.get("Jumlah kunjungan"))),
        "total_spent": num(r.get("Jumlah yang dibayarkan")),
        "created_at": now,
    })

if docs:
    db.customers.insert_many(docs)
print("Inserted customers:", len(docs), "| skipped (no name):", skipped)
print("Total customers now:", db.customers.count_documents({"tenant_id": tid}))
