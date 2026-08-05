"""KasirCloud POS backend integration tests."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cloud-pos-modern.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_USER = "social.surya@gmail.com"
OWNER_PASS = "Owner#2026"


# ------------ fixtures ------------
@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"username": OWNER_USER, "password": OWNER_PASS})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["role"] == "Owner"
    return data["token"]


@pytest.fixture(scope="session")
def owner_client(owner_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def kasir_credentials(owner_client):
    """Ensure a kasir user exists; return login creds."""
    uname = "kasir1"
    pwd = "kasir123"
    # attempt to create; if exists, update password to known value
    r = owner_client.post(f"{API}/users", json={"username": uname, "password": pwd, "name": "Kasir Satu", "role": "Kasir"})
    if r.status_code == 400:
        # already exists; find and reset password
        users = owner_client.get(f"{API}/users").json()
        uid = next((u["id"] for u in users if u["username"] == uname), None)
        assert uid
        rr = owner_client.put(f"{API}/users/{uid}", json={"password": pwd, "active": True, "role": "Kasir"})
        assert rr.status_code == 200
    else:
        assert r.status_code == 200, r.text
    return {"username": uname, "password": pwd}


@pytest.fixture(scope="session")
def kasir_client(kasir_credentials):
    r = requests.post(f"{API}/auth/login", json=kasir_credentials)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ------------ Auth ------------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"username": "nope", "password": "x"})
        assert r.status_code == 401

    def test_me(self, owner_client):
        r = owner_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "Owner"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ------------ Categories ------------
class TestCategories:
    def test_crud(self, owner_client):
        payload = {"name": f"TEST_Cat_{uuid.uuid4().hex[:6]}", "color": "#FF0000"}
        r = owner_client.post(f"{API}/categories", json=payload)
        assert r.status_code == 200
        cat = r.json()
        assert cat["name"] == payload["name"]
        cid = cat["id"]
        # list
        lst = owner_client.get(f"{API}/categories").json()
        assert any(c["id"] == cid for c in lst)
        # update
        r = owner_client.put(f"{API}/categories/{cid}", json={"name": payload["name"] + "_upd", "color": "#00FF00"})
        assert r.status_code == 200
        # delete
        r = owner_client.delete(f"{API}/categories/{cid}")
        assert r.status_code == 200


# ------------ Products ------------
@pytest.fixture(scope="class")
def sample_product(owner_client):
    payload = {"name": f"TEST_Prod_{uuid.uuid4().hex[:6]}", "sku": "T-001", "price": 10000, "cost": 6000, "stock": 50, "min_stock": 5}
    r = owner_client.post(f"{API}/products", json=payload)
    assert r.status_code == 200
    return r.json()


class TestProducts:
    def test_create_and_persist(self, owner_client, sample_product):
        pid = sample_product["id"]
        prods = owner_client.get(f"{API}/products").json()
        p = next((x for x in prods if x["id"] == pid), None)
        assert p is not None
        assert p["price"] == 10000
        assert p["stock"] == 50

    def test_update_product(self, owner_client, sample_product):
        pid = sample_product["id"]
        upd = {**{k: sample_product[k] for k in ["name", "sku", "barcode", "category_id", "price", "cost", "stock", "min_stock", "unit", "image", "active"] if k in sample_product}}
        upd["price"] = 12000
        r = owner_client.put(f"{API}/products/{pid}", json=upd)
        assert r.status_code == 200
        prods = owner_client.get(f"{API}/products").json()
        p = next(x for x in prods if x["id"] == pid)
        assert p["price"] == 12000


# ------------ Inventory ------------
class TestInventory:
    def test_stock_masuk(self, owner_client, sample_product):
        pid = sample_product["id"]
        prods = owner_client.get(f"{API}/products").json()
        before = next(p["stock"] for p in prods if p["id"] == pid)
        r = owner_client.post(f"{API}/stock", json={"product_id": pid, "type": "Masuk", "qty": 10, "note": "restock"})
        assert r.status_code == 200
        mv = r.json()
        assert mv["after"] == before + 10
        prods = owner_client.get(f"{API}/products").json()
        assert next(p["stock"] for p in prods if p["id"] == pid) == before + 10

    def test_stock_opname(self, owner_client, sample_product):
        pid = sample_product["id"]
        r = owner_client.post(f"{API}/stock", json={"product_id": pid, "type": "Opname", "qty": 100, "note": "audit"})
        assert r.status_code == 200
        assert r.json()["after"] == 100

    def test_movements_history(self, owner_client):
        r = owner_client.get(f"{API}/stock/movements")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------ Sales / POS ------------
class TestSales:
    def test_sale_flow_decrements_stock_and_refund(self, owner_client, sample_product):
        pid = sample_product["id"]
        # set known stock
        owner_client.post(f"{API}/stock", json={"product_id": pid, "type": "Opname", "qty": 20, "note": "reset"})
        payload = {
            "items": [{"product_id": pid, "name": sample_product["name"], "price": 12000, "qty": 3, "cost": 6000}],
            "discount": 0, "tax_rate": 0, "payment_method": "Tunai", "paid_amount": 50000, "customer_name": "TEST"
        }
        r = owner_client.post(f"{API}/sales", json=payload)
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["invoice"].startswith("INV-")
        assert sale["total"] == 36000
        assert sale["change"] == 14000
        sid = sale["id"]
        # verify stock decreased
        prods = owner_client.get(f"{API}/products").json()
        assert next(p["stock"] for p in prods if p["id"] == pid) == 17
        # refund
        r = owner_client.post(f"{API}/sales/{sid}/refund", json={})
        assert r.status_code == 200
        # stock restored
        prods = owner_client.get(f"{API}/products").json()
        assert next(p["stock"] for p in prods if p["id"] == pid) == 20
        # double refund fails
        r = owner_client.post(f"{API}/sales/{sid}/refund", json={})
        assert r.status_code == 400

    def test_empty_cart_rejected(self, owner_client):
        r = owner_client.post(f"{API}/sales", json={"items": [], "payment_method": "Tunai"})
        assert r.status_code == 400


# ------------ Dashboard & Reports ------------
class TestDashboard:
    def test_dashboard(self, owner_client):
        r = owner_client.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["today_revenue", "today_transactions", "today_profit", "total_revenue",
                  "product_count", "low_stock_count", "low_stock", "sales_series", "top_products", "activities"]:
            assert k in d
        assert len(d["sales_series"]) == 7

    def test_reports_sales(self, owner_client):
        r = owner_client.get(f"{API}/reports/sales")
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "profit" in d and "count" in d and "by_method" in d


# ------------ Settings ------------
class TestSettings:
    def test_update_and_persist(self, owner_client):
        r = owner_client.put(f"{API}/settings", json={"tax_rate": 11.0, "business_name": "Toko Surya"})
        assert r.status_code == 200
        r = owner_client.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert s.get("tax_rate") == 11.0


# ------------ RBAC ------------
class TestRBAC:
    def test_kasir_cannot_list_users(self, kasir_client):
        r = kasir_client.get(f"{API}/users")
        assert r.status_code == 403

    def test_kasir_cannot_view_reports(self, kasir_client):
        r = kasir_client.get(f"{API}/reports/sales")
        assert r.status_code == 403

    def test_kasir_cannot_create_product(self, kasir_client):
        r = kasir_client.post(f"{API}/products", json={"name": "x", "price": 1})
        assert r.status_code == 403

    def test_kasir_cannot_refund(self, kasir_client, owner_client, sample_product):
        # create a sale as owner
        owner_client.post(f"{API}/stock", json={"product_id": sample_product["id"], "type": "Opname", "qty": 10, "note": ""})
        sale = owner_client.post(f"{API}/sales", json={
            "items": [{"product_id": sample_product["id"], "name": sample_product["name"], "price": 1000, "qty": 1, "cost": 500}],
            "payment_method": "Tunai", "paid_amount": 1000
        }).json()
        r = kasir_client.post(f"{API}/sales/{sale['id']}/refund", json={})
        assert r.status_code == 403

    def test_kasir_can_access_dashboard_and_sales(self, kasir_client):
        assert kasir_client.get(f"{API}/dashboard").status_code == 200
        assert kasir_client.get(f"{API}/products").status_code == 200
        assert kasir_client.get(f"{API}/categories").status_code == 200


# ------------ Users mgmt ------------
class TestUsers:
    def test_owner_list_users(self, owner_client):
        r = owner_client.get(f"{API}/users")
        assert r.status_code == 200
        users = r.json()
        assert any(u["role"] == "Owner" for u in users)
        for u in users:
            assert "password_hash" not in u
            assert "_id" not in u
