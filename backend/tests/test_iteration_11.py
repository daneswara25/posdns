"""Iteration 11 review tests: customer aggregation bug fix + Kasir settings RBAC + reprint data."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://daneswara-retail.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"username": "admin", "password": "Limited0"}
KASIR = {"username": "kasirtest", "password": "Kasir123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_client():
    tok = _login(OWNER)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def kasir_client():
    tok = _login(KASIR)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


# ---------- ITEM 2: Customer totals from real sales ----------
class TestCustomerAggregationFix:
    def test_customers_totals_match_history_sum(self, owner_client):
        r = owner_client.get(f"{API}/customers")
        assert r.status_code == 200
        customers = r.json()
        assert isinstance(customers, list)

        # Every customer must expose computed fields
        for c in customers:
            assert "total_spent" in c and "visits" in c
            assert isinstance(c["total_spent"], (int, float))
            assert isinstance(c["visits"], int)

        # Verify aggregation matches non-refunded sales history for up to 5 customers with activity
        checked = 0
        for c in customers:
            if c["visits"] == 0:
                continue
            h = owner_client.get(f"{API}/customers/{c['id']}/history")
            assert h.status_code == 200
            hist = h.json()
            hist_total = sum(s["total"] for s in hist)
            hist_count = len(hist)
            assert hist_count == c["visits"], (
                f"Customer {c['name']} visits {c['visits']} != history len {hist_count}"
            )
            assert hist_total == c["total_spent"], (
                f"Customer {c['name']} total_spent {c['total_spent']} != history sum {hist_total}"
            )
            checked += 1
            if checked >= 5:
                break

    def test_gita_not_inflated(self, owner_client):
        """Look for a customer with 'GITA' in name; assert values are not the stale 51,841,940 / 183."""
        customers = owner_client.get(f"{API}/customers").json()
        gita = [c for c in customers if "GITA" in (c.get("name") or "").upper()]
        if not gita:
            pytest.skip("No customer named GITA present")
        for c in gita:
            assert not (c["total_spent"] == 51841940 and c["visits"] == 183), (
                f"Stale imported counters still returned for {c['name']}"
            )


# ---------- ITEM 3: Kasir Settings RBAC ----------
class TestKasirSettings:
    def test_kasir_get_settings(self, kasir_client):
        r = kasir_client.get(f"{API}/settings")
        assert r.status_code == 200

    def test_kasir_can_save_printer_fields(self, kasir_client, owner_client):
        # baseline settings from owner
        before = owner_client.get(f"{API}/settings").json()
        payload = {
            "print_mode": "desktop",
            "paper_width": "80",
            "printers": [{"name": "TEST_Printer", "type": "desktop"}],
            "active_printer": "TEST_Printer",
        }
        r = kasir_client.put(f"{API}/settings", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        after = owner_client.get(f"{API}/settings").json()
        assert after.get("print_mode") == "desktop"
        assert after.get("paper_width") == "80"
        assert after.get("active_printer") == "TEST_Printer"
        # business_name (outlet info) must NOT have been mutated by Kasir
        if "business_name" in before:
            assert after.get("business_name") == before.get("business_name")

    def test_kasir_cannot_change_business_name(self, kasir_client, owner_client):
        before = owner_client.get(f"{API}/settings").json()
        original = before.get("business_name", "")
        r = kasir_client.put(f"{API}/settings", json={"business_name": "HACKED_BY_KASIR", "tax_rate": 99.9})
        # Endpoint returns ok but silently drops disallowed fields
        assert r.status_code == 200
        after = owner_client.get(f"{API}/settings").json()
        assert after.get("business_name", "") == original
        assert after.get("tax_rate") != 99.9 or before.get("tax_rate") == 99.9


# ---------- ITEM 4: Kasir can read sales for Riwayat Transaksi ----------
class TestKasirRiwayat:
    def test_kasir_can_list_sales(self, kasir_client):
        r = kasir_client.get(f"{API}/sales", params={"limit": 1000})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Every sale must expose reprint-relevant fields
        for s in data[:5]:
            for k in ("id", "invoice", "items", "total", "payment_method"):
                assert k in s


# ---------- ITEM 1: Settle-order stores payment_method for LUNAS VIA badge ----------
class TestOrderSettlePersistence:
    def test_new_completed_order_stores_payment_method(self, owner_client):
        """Create a fresh DP order, settle it, and confirm order doc stores payment_method for LUNAS VIA reprint."""
        # pick any product with stock
        prods = owner_client.get(f"{API}/products").json()
        prod = next((p for p in prods if p.get("stock", 0) > 5), None)
        if not prod:
            # create one
            prod = owner_client.post(f"{API}/products", json={
                "name": "TEST_Iter11_Prod", "price": 10000, "cost": 5000, "stock": 20, "min_stock": 1,
            }).json()

        create = owner_client.post(f"{API}/orders", json={
            "customer_name": "TEST_Iter11",
            "items": [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"], "qty": 1, "cost": prod.get("cost", 0)}],
            "discount": 0, "tax_rate": 0,
            "deposit_amount": 1000, "deposit_method": "Tunai",
        })
        assert create.status_code == 200, create.text
        order = create.json()
        oid = order["id"]
        remaining = order["total"] - order["deposit_amount"]

        r = owner_client.post(f"{API}/orders/{oid}/complete", json={"payment_method": "BCA TOKO", "paid_amount": remaining})
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["payment_method"] == "BCA TOKO"

        orders = owner_client.get(f"{API}/orders").json()
        this = next(o for o in orders if o["id"] == oid)
        assert this.get("status") == "Selesai"
        assert this.get("payment_method") == "BCA TOKO", "Order doc must store payment_method for LUNAS VIA reprint"
