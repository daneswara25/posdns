"""New feature tests: customers, suppliers, purchases, held orders, custom orders."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pos-cloud-modern.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_USER = "social.surya@gmail.com"
OWNER_PASS = "Owner#2026"


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{API}/auth/login", json={"username": OWNER_USER, "password": OWNER_PASS})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def product(client):
    r = client.post(f"{API}/products", json={
        "name": f"TEST_NF_{uuid.uuid4().hex[:6]}", "sku": "NF-1",
        "price": 5000, "cost": 3000, "stock": 100, "min_stock": 5,
    })
    assert r.status_code == 200
    return r.json()


# ---- Customers ----
class TestCustomers:
    def test_create_customer_and_list(self, client):
        r = client.post(f"{API}/customers", json={"name": "TEST_Andi", "phone": "0811", "email": "a@b.c"})
        assert r.status_code == 200
        c = r.json()
        assert c["name"] == "TEST_Andi"
        assert c["points"] == 0
        assert c["total_spent"] == 0
        pytest.customer_id = c["id"]
        # list
        lst = client.get(f"{API}/customers").json()
        assert any(x["id"] == c["id"] for x in lst)

    def test_update_customer(self, client):
        r = client.put(f"{API}/customers/{pytest.customer_id}",
                       json={"name": "TEST_Andi_Upd", "phone": "0812", "email": "", "address": "Jl Baru"})
        assert r.status_code == 200
        lst = client.get(f"{API}/customers").json()
        c = next(x for x in lst if x["id"] == pytest.customer_id)
        assert c["name"] == "TEST_Andi_Upd"

    def test_sale_with_customer_adds_points(self, client, product):
        # Set known stock
        client.post(f"{API}/stock", json={"product_id": product["id"], "type": "Opname", "qty": 50, "note": ""})
        r = client.post(f"{API}/sales", json={
            "items": [{"product_id": product["id"], "name": product["name"], "price": 5000, "qty": 3, "cost": 3000}],
            "payment_method": "Tunai", "paid_amount": 15000, "customer_id": pytest.customer_id,
        })
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["total"] == 15000
        assert sale["points_earned"] == 15  # 15000 // 1000
        assert sale["customer_id"] == pytest.customer_id
        # verify customer points updated
        lst = client.get(f"{API}/customers").json()
        c = next(x for x in lst if x["id"] == pytest.customer_id)
        assert c["points"] >= 15
        assert c["visits"] >= 1
        assert c["total_spent"] >= 15000

    def test_customer_history(self, client):
        r = client.get(f"{API}/customers/{pytest.customer_id}/history")
        assert r.status_code == 200
        hist = r.json()
        assert isinstance(hist, list) and len(hist) >= 1
        assert all(s["customer_id"] == pytest.customer_id for s in hist)


# ---- Suppliers ----
class TestSuppliers:
    def test_crud(self, client):
        r = client.post(f"{API}/suppliers", json={"name": "TEST_Sup", "phone": "0813"})
        assert r.status_code == 200
        s = r.json()
        sid = s["id"]
        assert s["name"] == "TEST_Sup"
        lst = client.get(f"{API}/suppliers").json()
        assert any(x["id"] == sid for x in lst)
        r = client.put(f"{API}/suppliers/{sid}", json={"name": "TEST_Sup_Upd", "phone": "0814"})
        assert r.status_code == 200
        r = client.delete(f"{API}/suppliers/{sid}")
        assert r.status_code == 200


# ---- Purchase Orders ----
class TestPurchases:
    def test_create_po_and_receive(self, client, product):
        # baseline stock
        prods = client.get(f"{API}/products").json()
        before = next(p["stock"] for p in prods if p["id"] == product["id"])
        # Create supplier
        sup = client.post(f"{API}/suppliers", json={"name": "TEST_SupPO"}).json()
        # Create PO
        r = client.post(f"{API}/purchases", json={
            "supplier_id": sup["id"], "supplier_name": sup["name"],
            "items": [{"product_id": product["id"], "name": product["name"], "qty": 25, "cost": 3500}],
            "note": "test",
        })
        assert r.status_code == 200, r.text
        po = r.json()
        assert po["po_number"].startswith("PO-")
        assert po["total"] == 25 * 3500
        assert po["status"] == "Menunggu"
        pid = po["id"]
        # Receive
        r = client.post(f"{API}/purchases/{pid}/receive")
        assert r.status_code == 200
        # Stock increased
        prods = client.get(f"{API}/products").json()
        after = next(p["stock"] for p in prods if p["id"] == product["id"])
        assert after == before + 25
        # Movement recorded
        movs = client.get(f"{API}/stock/movements").json()
        assert any(m["product_id"] == product["id"] and m["type"] == "Masuk"
                   and po["po_number"] in (m.get("note") or "") for m in movs)
        # Cannot receive twice
        r = client.post(f"{API}/purchases/{pid}/receive")
        assert r.status_code == 400


# ---- Held Orders ----
class TestHeldOrders:
    def test_hold_and_delete(self, client, product):
        r = client.post(f"{API}/held-orders", json={
            "label": "Meja 5",
            "items": [{"product_id": product["id"], "name": product["name"], "price": 5000, "qty": 2, "cost": 3000}],
            "discount": 0,
        })
        assert r.status_code == 200
        h = r.json()
        assert h["label"] == "Meja 5"
        hid = h["id"]
        lst = client.get(f"{API}/held-orders").json()
        assert any(x["id"] == hid for x in lst)
        r = client.delete(f"{API}/held-orders/{hid}")
        assert r.status_code == 200


# ---- Custom Orders + Deposit + Complete ----
class TestCustomOrders:
    def test_create_and_complete_order(self, client, product):
        # Set stock and remember
        client.post(f"{API}/stock", json={"product_id": product["id"], "type": "Opname", "qty": 30, "note": ""})
        prods_before = client.get(f"{API}/products").json()
        stock_before = next(p["stock"] for p in prods_before if p["id"] == product["id"])

        r = client.post(f"{API}/orders", json={
            "customer_name": "TEST_CustOrder", "items": [
                {"product_id": product["id"], "name": product["name"], "price": 5000, "qty": 4, "cost": 3000}
            ],
            "discount": 0, "tax_rate": 0, "deposit_amount": 10000, "deposit_method": "Tunai",
        })
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["total"] == 20000
        assert o["deposit_amount"] == 10000
        assert o["remaining"] == 10000
        assert o["status"] == "Proses"
        # Stock NOT decremented yet
        prods_mid = client.get(f"{API}/products").json()
        stock_mid = next(p["stock"] for p in prods_mid if p["id"] == product["id"])
        assert stock_mid == stock_before

        # Complete order
        r = client.post(f"{API}/orders/{o['id']}/complete", json={"payment_method": "Tunai", "paid_amount": 10000})
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["invoice"].startswith("INV-")
        assert sale["total"] == 20000

        # Order becomes Selesai
        orders = client.get(f"{API}/orders").json()
        this = next(x for x in orders if x["id"] == o["id"])
        assert this["status"] == "Selesai"
        # Stock decremented
        prods_after = client.get(f"{API}/products").json()
        stock_after = next(p["stock"] for p in prods_after if p["id"] == product["id"])
        assert stock_after == stock_before - 4
        # Cannot complete twice
        r = client.post(f"{API}/orders/{o['id']}/complete", json={"payment_method": "Tunai", "paid_amount": 0})
        assert r.status_code == 400


# ---- Cost field optional on product create ----
class TestProductCostOptional:
    def test_create_without_cost(self, client):
        r = client.post(f"{API}/products", json={
            "name": f"TEST_NoCost_{uuid.uuid4().hex[:6]}",
            "price": 2500, "stock": 10,
        })
        assert r.status_code == 200
        p = r.json()
        assert p["cost"] == 0
        # Now edit to add cost
        r = client.put(f"{API}/products/{p['id']}", json={
            "name": p["name"], "sku": "", "price": 2500, "cost": 1500, "stock": 10, "min_stock": 5,
        })
        assert r.status_code == 200
