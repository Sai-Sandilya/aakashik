# Aakashik API — Test Cases & Manual Testing

Automated with **Node.js built-in test runner** (`node --test`). Specs live in `api/tests/*.test.js`.

## Run automated tests

```bash
cd api
npm install
npm test
```

From repo root:

```bash
npm run api:test
```

---

## Test matrix

### Health & admin auth (`admin-auth.test.js`)

| ID | Test case | Type | Expected |
|----|-----------|------|----------|
| TC-API01 | GET /health | + | `{ ok: true, service: "aakashik-api" }` |
| TC-API02 | Admin login with demo credentials | + | 200 + JWT token |
| TC-API03 | Wrong admin password | − | 401 `invalid_credentials` |
| TC-API04 | Missing login fields | − | 400 validation error |
| TC-API05 | GET /api/admin/me with token | + | Admin profile |
| TC-API06 | Protected route without token | − | 401 |
| TC-API07 | Protected route with invalid token | − | 401 |

### Products (`products.test.js`)

| ID | Test case | Type | Expected |
|----|-----------|------|----------|
| TC-API10 | Store catalog lists 9 built-ins | + | 9 products |
| TC-API11 | GET single product | + | Product detail + stock |
| TC-API12 | Unknown product | − | 404 |
| TC-API13 | Create custom product w/ discount | + | Sale price computed |
| TC-API14 | Missing product name | − | 400 |
| TC-API15 | Discount > 90% | − | 400 |
| TC-API16 | Draft hidden from store | + | Not in `/api/products` |
| TC-API17 | Hide/show built-in | + | Store catalog updates |
| TC-API18 | Edit custom name + discount | + | PATCH applied |
| TC-API19 | Delete custom product | + | Removed from admin list |
| TC-API20 | Delete built-in | − | 400 |

### Inventory (`inventory.test.js`)

| ID | Test case | Type | Expected |
|----|-----------|------|----------|
| TC-API30 | List 9 SKUs | + | Default stock seeded |
| TC-API31 | Set exact quantity | + | Badge updates |
| TC-API32 | Adjust +1 / −1 | + | Quantity changes |
| TC-API33 | Negative stock rejected | − | 400 |
| TC-API34 | Out-of-stock filter | + | Only qty 0 |
| TC-API35 | Low-stock filter (1–5) | + | Low badge |
| TC-API36 | Reseed defaults | + | immunity = 30 |
| TC-API37 | Custom SKU in inventory | + | Stock from create |

### Orders (`orders.test.js`)

| ID | Test case | Type | Expected |
|----|-----------|------|----------|
| TC-API40 | List seeded mock orders | + | AAK-10001 present |
| TC-API41 | Filter by status | + | Only matching status |
| TC-API42 | Search by phone | + | Match found |
| TC-API43 | Checkout deducts stock | + | 201 + stock −1 |
| TC-API44 | Empty cart | − | 400 |
| TC-API45 | Missing delivery name | − | 400 |
| TC-API46 | Invalid pincode | − | 400 |
| TC-API47 | Insufficient stock | − | 409 |
| TC-API48 | Track order 5 steps | + | Timeline JSON |
| TC-API49 | Track unknown order | − | 404 |
| TC-API50 | pending → packed | + | Status history grows |
| TC-API51 | pending → delivered jump | − | 400 invalid_transition |
| TC-API52 | Cancel pending order | + | track.cancelled true |
| TC-API53 | No transition from delivered | − | 400 |

### Integration (`integration.test.js`)

| ID | Test case | Type | Expected |
|----|-----------|------|----------|
| TC-API60 | Publish → checkout → full delivery track | + | End-to-end flow |
| TC-API61 | Hidden SKU blocked at checkout | − | 400 invalid_product |
| TC-API62 | Last unit cannot oversell | − | One 201, one 409 |
| TC-API63 | Draft → publish → OOS → delete | + | Full product lifecycle |
| TC-API64 | packed → cancelled audit trail | + | 3 history entries |
| TC-API65 | All admin routes require auth | − | 401 |

---

## Manual API testing (curl)

Start the server first:

```bash
cd api
npm install
npm start
```

Base URL: `http://127.0.0.1:3001`

### 1. Health check

```bash
curl -s http://127.0.0.1:3001/health | jq
```

### 2. Admin login (save token)

```bash
curl -s -X POST http://127.0.0.1:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aakashik.local","password":"Admin@1234"}' | jq
```

Copy the `token` value, then:

```bash
export TOKEN="paste-token-here"
```

### 3. Verify admin session

```bash
curl -s http://127.0.0.1:3001/api/admin/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 4. Store catalog (public)

```bash
curl -s http://127.0.0.1:3001/api/products | jq
curl -s http://127.0.0.1:3001/api/products/immunity | jq
```

### 5. Create custom product (admin)

```bash
curl -s -X POST http://127.0.0.1:3001/api/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manual Test Brew",
    "description": "Created via curl",
    "priceN": 299,
    "discountPct": 10,
    "stock": 5,
    "concern": "Immunity",
    "active": true
  }' | jq
```

### 6. Inventory

```bash
curl -s http://127.0.0.1:3001/api/admin/inventory \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s -X PATCH http://127.0.0.1:3001/api/admin/inventory/immunity \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 25}' | jq
```

### 7. Place order (public checkout)

```bash
curl -s -X POST http://127.0.0.1:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "immunity", "name": "Daily Immunity", "qty": 1, "unitPrice": 349}],
    "delivery": {
      "name": "Manual Tester",
      "phone": "9876543210",
      "email": "manual@test.com",
      "address": "1 Test Street",
      "city": "Hyderabad",
      "state": "Telangana",
      "pincode": "500001"
    },
    "payMethod": "cod",
    "total": 349
  }' | jq
```

Save the returned `order.id`, then:

```bash
export ORDER_ID="AAK-xxxxx"
```

### 8. Track order (public)

```bash
curl -s http://127.0.0.1:3001/api/orders/$ORDER_ID/track | jq
```

### 9. Admin orders + status update

```bash
curl -s http://127.0.0.1:3001/api/admin/orders \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s -X PATCH http://127.0.0.1:3001/api/admin/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "packed"}' | jq
```

Track again — step 2 should show `done: true`:

```bash
curl -s http://127.0.0.1:3001/api/orders/$ORDER_ID/track | jq
```

### 10. Hide built-in from store

```bash
curl -s -X PATCH http://127.0.0.1:3001/api/admin/products/sunni/visibility \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hidden": true}' | jq

curl -s http://127.0.0.1:3001/api/products | jq '.products[] | select(.id=="sunni")'
```

---

## Postman / Thunder Client

1. Create collection **Aakashik API**
2. Set variable `baseUrl` = `http://127.0.0.1:3001`
3. Run **Admin Login** → add Tests script:

```javascript
const json = pm.response.json();
pm.collectionVariables.set('token', json.token);
```

4. On admin requests, Authorization → **Bearer Token** → `{{token}}`
5. Import the curl examples above as requests

---

## Negative tests to try manually

| Action | Expected |
|--------|----------|
| Login with wrong password | 401 |
| Call `/api/admin/orders` without token | 401 |
| Checkout with empty `items` | 400 |
| Checkout with pincode `12345` | 400 |
| Set immunity stock to 0, then checkout immunity | 409 |
| Jump order status pending → delivered | 400 |

---

## CI

GitHub Actions runs `npm run api:test` alongside Playwright E2E on every push.
