# Aakashik Auth — E2E Test Cases

Automated with [Playwright](https://playwright.dev/). Tests run against the local static site (`python3 -m http.server 8080`).

## How to run

```bash
npm install
npx playwright install chromium
npm test
```

Other commands:

| Command | Description |
|---------|-------------|
| `npm run test:headed` | Run tests in a visible browser |
| `npm run test:ui` | Open Playwright UI mode |
| `npm run test:report` | View HTML report after a run |

---

## GitHub Actions (automatic testing on push)

When code is pushed to [github.com/Sai-Sandilya/aakashik](https://github.com/Sai-Sandilya/aakashik), GitHub automatically:

1. Installs Node.js and dependencies
2. Installs Playwright Chromium
3. Runs all 15 E2E tests
4. Uploads a test report if any test fails

View runs under the repo **Actions** tab → **E2E Tests**.

---

## Category 1 UX fixes (`tests/category1-ux.spec.js`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| TC-C01 | Guest adds item to cart | No sign-in required; toast "Added to cart" |
| TC-C02 | Cart survives page reload | Items still in cart (`ak_cart` in localStorage) |
| TC-C03 | Wishlist survives reload | Wishlist saved in `ak_wishlist` |
| TC-C04 | Newsletter subscribe | Email stored in `ak_newsletter` |
| TC-C05 | Ritual reminder form | Contact/time stored in `ak_reminder` |
| TC-C06 | Profile save validation | Requires phone OR email |
| TC-C07 | Order tracking (valid ID) | Shows order steps for stored order |
| TC-C08 | Order tracking (invalid ID) | Shows "No order found" |
| TC-C09 | Checkout login lockout | Locks after 5 failed email/password attempts |
| TC-C10 | Language preference | `ak_lang` persists after reload |

**Phone auth rule:** Phone login/signup uses **OTP only** — no password required.

---

## UX high fixes (`tests/ux-high.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-H01–H02 | Shipping ads removed (no ₹500 / ₹49) | + / − |
| TC-H03 | Diwali / promo offer removed | + |
| TC-H04–H06 | No returns (trust, order success, policy) | + / − |
| TC-H07–H09 | Order tracking always shows 5 steps | + / − |
| TC-H10–H12 | Member 10% pricing | + / − |
| TC-H13–H20 | Mock COD / UPI / Card payment | + / − |
| TC-H21–H22 | Cart lines separated by size | + / − |
| TC-H23–H26 | Real product mapping + price truth | + / − |
| TC-H27–H30 | Wishlist drawer | + / − |
| TC-H31 | Auth member pricing copy | + |

---

## Order History UX (`tests/order-history.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-OH01 | Order History opens from account menu | + |
| TC-OH02 | Shows products, status, Track | + |
| TC-OH03 | Track from history opens steps | + |
| TC-OH04 | Empty history state | − |
| TC-OH05 | Profile no longer lists orders | − |
| TC-OH06 | Track from Order Placed success | + |

---


## Auth page (`Aakashik Auth.dc.html`)

### Validation

| ID | Test case | Expected result | Spec |
|----|-----------|-----------------|------|
| TC-A01 | Enter invalid email-like text (`saisdjhsd`) on signup | Shows **email** validation message, not phone error | `auth.spec.js` |
| TC-A02 | Enter invalid phone (`12345`) on sign-in | Shows 10-digit Indian mobile error | `auth.spec.js` |
| TC-A03 | Signup with weak password (`short`) | Blocked with strength requirement message | `auth.spec.js` |
| TC-A04 | Signup with mismatched confirm password | Blocked with "Passwords do not match" | `auth.spec.js` |

### Create account

| ID | Test case | Expected result | Spec |
|----|-----------|-----------------|------|
| TC-A05 | Email signup → OTP → verify | Success screen "Account created!", `ak_logged=1` | `auth.spec.js` |
| TC-A06 | Phone signup → OTP → verify | Success screen "Account created!" | `auth.spec.js` |

### Sign in

| ID | Test case | Expected result | Spec |
|----|-----------|-----------------|------|
| TC-A07 | Sign in with correct email + password | "Welcome back!" success screen | `auth.spec.js` |
| TC-A08 | Sign in with wrong password | Generic "Incorrect email or password" | `auth.spec.js` |
| TC-A09 | Toggle Sign In ↔ Create Account tabs | Correct form titles shown | `auth.spec.js` |

### Forgot password

| ID | Test case | Expected result | Spec |
|----|-----------|-----------------|------|
| TC-A10 | Request reset → enter code → set new password | "Password updated" message | `auth.spec.js` |
| TC-A11 | Sign in after password reset | Login succeeds with new password | `auth.spec.js` |

---

## Landing page (`Aakashik Landing.dc.html`)

### Profile

| ID | Test case | Expected result | Spec |
|----|-----------|-----------------|------|
| TC-P01 | Open account menu when logged in | Shows **Profile** and **Log out** options | `profile-logout.spec.js` |
| TC-P02 | Edit profile (name, phone, address, city, state, pin) | Saved to `ak_profile`, survives page reload | `profile-logout.spec.js` |
| TC-P03 | Visit store as guest | Sign-in link visible, no account menu | `profile-logout.spec.js` |

### Logout

| ID | Test case | Expected result | Spec |
|----|-----------|-----------------|------|
| TC-L01 | Click Log out from account menu | `ak_logged` cleared, sign-in link shown | `profile-logout.spec.js` |

---

## Medium UX fixes (`ux-medium.spec.js`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| TC-M11 | Checkout delivery contact | Phone **or** email accepted (hint shown) |
| TC-M12 | Keep me signed in off | Session in `sessionStorage` only; Landing still logged in |
| TC-M13 | Login with leftover profile | New login **replaces** profile (no merge) |
| TC-M14 | Logout | Clears `ak_profile` as well as session flags |
| TC-M15 | Forgot password with phone | Rejected — email-only reset |
| TC-M16 | Google / GitHub buttons | Labeled **(demo)** |
| TC-M17 | OTP when pending missing | "No active verification code" |
| TC-M18 | Track modal wrong ID | "Track another order" retries without reopen |
| TC-M19 | Order history | Only current user's orders shown |
| TC-M20 | Language switcher | Discloses partial translation |
| TC-M21 | Category card | Opens search filtered by concern |
| TC-M22 | Search kits | Bundles/kits appear in results |
| TC-M23 | Price filter | Size price ranges included |
| TC-M24 | Subscribe & Save | Labeled Save 10% (demo) |
| TC-M25 | Auth lockout | Shared via `ak_lock_until` |
| TC-M26 | Reminder validation | WhatsApp/SMS requires valid phone |
| TC-M27 | Profile email change | Migrates `ak_users` login key |
| TC-M28 | Filenames in links | Percent-encoded (`Aakashik%20…`) |

---

## Low UX / a11y polish (`ux-low.spec.js`)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| TC-L29 | Featured Products rendered | Section visible with catalog products |
| TC-L29b | Recently viewed | Appears after opening Quick View |
| TC-L30 | Dead links fixed | Ingredients → `#ingredients`; Home → `#top`; social = coming soon |
| TC-L31 | Empty image slots | Founders + category cards use real `<img>` |
| TC-L32 | Escape closes modals | Quick View closes on Escape |
| TC-L33 | Toast / menus a11y | `aria-live` toast; account menu outside-click |
| TC-L34 | Mobile gap 820–860 | At 840px mobile bar shown, desktop nav hidden |
| TC-L35 | Marketing stats | Honest `9` blends & `2021` founded (no 40+/12k+) |
| TC-L36 | Auth terms link | Points to Landing `#legal-terms` |
| TC-L37 | Net-banking copy | Not advertised |
| TC-L38 | Diwali / pendingAdd | No festival banner; checkout auth is “Sign in to check out” only |

---

## Remaining UX audit (`tests/ux-remaining.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-R01 | Signup stores `pwHash` only (no plaintext; user written after OTP) | + |
| TC-R02 | Wrong password vs hashed user | − |
| TC-R03 | Legacy plaintext migrates to `pwHash` on sign-in | + |
| TC-R04 | Auth demo banner (OTP/reset simulated) | + |
| TC-R05 | Phone sign-in requires existing account | − |
| TC-R06 | Phone signup via OTP still works | + |
| TC-R07 | Reviews = sample stories (no 1,240+ / Verified buyer) | + |
| TC-R08 | Medical overclaims removed from sample reviews | − |
| TC-R09 | Kit prices match Save ₹ vs singles (599 / 349) | + |
| TC-R10 | “Sugar Balance Support” replaces “Diabetic Care” | + |
| TC-R11 | Order confirm = saved on device (demo) | + |
| TC-R12 | Track modal discloses simulated timeline | + |
| TC-R13 | Reminder + newsletter device-only demo copy | + |
| TC-R14 | Checkout “Keep me signed in” persists session | + |
| TC-R15 | Checkout invalid phone rejected | − |
| TC-R16 | Delivery fields have visible labels | + |
| TC-R17 | Member + Subscribe do not stack beyond 10% | + |
| TC-R18 | Guest without subscribe pays full list price | − |
| TC-R19 | Cart/Search dialog roles | + |
| TC-R20 | i18n disclosure: cart/checkout stay English | + |
| TC-R21 | Weather geolocation is opt-in | + |
| TC-R22 | Placeholders use `you@example.com` | + |
| TC-R23 | Dead `image-slot` import removed | + |
| TC-R24 | Track result shows Simulated timeline badge | + |

---

## Final polish UX (`tests/ux-final.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-F01 | Auth demo OTP copy (phone + email) | + |
| TC-F02 | Auth no longer claims “We'll send” OTP | − |
| TC-F03 | OTP verify keeps `pwHash` if pending cleared mid-delay | + |
| TC-F04 | Forgot password rejects unknown email (no orphan) | − |
| TC-F05 | Forgot password still works for existing email | + |
| TC-F06 | Email signup blocked when account exists | − |
| TC-F07 | Demo Google writes `ak_users` | + |
| TC-F08 | Pan-India delivery planned/demo copy | + |
| TC-F09 | Live 24–48h dispatch claim removed | − |
| TC-F10 | Reviews subtitle = sample/demo | + |
| TC-F11 | Story/herb medical overclaims softened | − |
| TC-F12 | Kit card padding fixed | + |
| TC-F13 | Checkout signup blocks existing email | + |
| TC-F14 | Cart dialog receives focus on open | + |
| TC-F15 | Tab focus trap inside cart dialog | + |
| TC-F16 | Footer mailto / tel links | + |
| TC-F17 | Reminder eyebrow without “dose” | + |
| TC-F18 | Order history empty = simulated tracking | + |
| TC-F19 | Privacy describes demo orders / mock payments | + |
| TC-F20 | Privacy no longer claims live shipping partners | − |

---

## Checkout required fields (`tests/ux-checkout-required.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-D01 | Empty address/city/pin/state does not place order | − |
| TC-D02 | Missing state blocks order | − |
| TC-D03 | Missing pincode blocks order | − |
| TC-D04 | No phone and no email blocks order | − |
| TC-D05 | Complete delivery details places order | + |
| TC-D06 | Helper copy says address fields are required | + |

---

## Phone signup overwrite (`tests/ux-phone-signup.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-P01 | Auth phone signup blocked when phone already exists (name preserved) | − |
| TC-P02 | Auth phone signup still works for a new number | + |
| TC-P03 | Existing phone can still sign in with OTP | + |
| TC-P04 | Checkout phone signup blocked when phone already exists | − |
| TC-P05 | Checkout phone signup works for a new number | + |

---

## Admin Orders mock (`tests/admin-orders.spec.js`)

Demo owner console (no database yet). Login: `owner@aakashik.local` / `Admin@1234`.

| ID | Focus | Type |
|----|--------|------|
| TC-AD01 | Wrong admin password rejected | − |
| TC-AD02 | Demo owner can sign in | + |
| TC-AD03 | Logout clears admin session | + |
| TC-AD04 | Mock seeds five sample orders | + |
| TC-AD05 | Confirmed filter shows only confirmed | + |
| TC-AD06 | Search by phone finds order | + |
| TC-AD07 | Search with no match shows empty state | − |
| TC-AD08 | Order detail shows customer + items | + |
| TC-AD09 | Confirmed → Packed → Shipped → Out for delivery → Delivered | + |
| TC-AD10 | Cannot jump Confirmed → Delivered | − |
| TC-AD11 | Delivered order has no further actions | − |
| TC-AD12 | Confirmed order can be cancelled | + |
| TC-AD13 | Login auto-pulls store checkout order | + |
| TC-AD14 | Manual pull with no store orders toasts | − |
| TC-AD15 | Reseed restores mocks, keeps store orders | + |
| TC-AD16 | Admin opens by direct URL only (no store footer link) | + |
| TC-AD17 | Filter + status persists after reload | + |
| TC-AD18 | Duplicate pull does not duplicate IDs | − |
| TC-AD19 | Live poll shows new store order without refresh | + |
| TC-AD20 | Admin status update matches store Track Your Order | + |

---

## Admin Inventory mock (`tests/admin-inventory.spec.js`)

Demo owner inventory in `ak_stock`. Low stock ≤ 5. Store checkout deducts units.

| ID | Focus | Type |
|----|--------|------|
| TC-IN01 | Inventory tab shows 9 seeded SKUs | + |
| TC-IN02 | Orders tab still works after Inventory | + |
| TC-IN03 | Save sets exact stock quantity | + |
| TC-IN04 | + / − adjust stock by one | + |
| TC-IN05 | Save rejects non-numeric stock | − |
| TC-IN06 | Out of stock filter after zeroing | + |
| TC-IN07 | Low stock filter for qty 1–5 | + |
| TC-IN08 | Reseed stock restores defaults | + |
| TC-IN09 | Zero stock blocks add-to-cart on store | + |
| TC-IN10 | Checkout deducts stock | + |
| TC-IN11 | Admin zero → restock unlocks store | + |
| TC-IN12 | Cannot cart more than available stock | − |
| TC-IN13 | Search inventory + stock persists reload | + |

---

## Admin Products mock (`tests/admin-products.spec.js`)

Owner can add custom products (name, description, price, discount %, stock, photo, category, active) stored in `ak_custom_products`. Built-ins can be hidden via `ak_hidden_ids`. Delete removes custom products from the store.

| ID | Focus | Type |
|----|--------|------|
| TC-PR01 | Products tab opens with add form | + |
| TC-PR02 | Publish stores catalog + stock + discount price | + |
| TC-PR03 | Missing name rejected | − |
| TC-PR04 | Discount over 90% rejected | − |
| TC-PR05 | Published product appears in store search | + |
| TC-PR06 | Draft product stays off store | + |
| TC-PR07 | Hide/show built-in on store | + |
| TC-PR08 | Delete custom removes from admin + store | + |
| TC-PR09 | Edit updates name and discount | + |
| TC-PR10 | Custom SKU appears in Inventory | + |
| TC-PR11 | Draft toggle then republish | + |

---

## REST API (`api/tests/*.test.js`)

Fastify + SQLite backend. Full matrix and manual curl guide: [`api/tests/API_TEST_CASES.md`](../api/tests/API_TEST_CASES.md).

Validation hardening plan: [`api/tests/VALIDATION_PLAN.md`](../api/tests/VALIDATION_PLAN.md)

| Suite | IDs | Count |
|-------|-----|-------|
| Admin auth | TC-API01–07 | 7 |
| Products | TC-API10–20 | 11 |
| Inventory | TC-API30–37 | 8 |
| Orders | TC-API40–53 | 14 |
| Integration | TC-API60–65 | 6 |
| **Validation** | **TC-VAL01–43** | **30** |

**Total API tests: 76**

```bash
npm run api:test    # from repo root
cd api && npm test  # from api folder
```

Demo admin: `owner@aakashik.local` / `Admin@1234` · API base: `http://127.0.0.1:3001`

---

## Search overlay full automation (`tests/search-overlay.spec.js`)

Every entry point, chip, search path, card action, empty/OOS edge, catalog sync, and multi-step flow for the Apothecary Shelf overlay.

| Range | Focus |
|-------|--------|
| TC-SO01–07 | Open/close, Escape, nav entry points |
| TC-SO08–12 | All category cards + Shop now links |
| TC-SO13–19 | Every Concern chip |
| TC-SO20–26 | Every Element chip + All-element bundles |
| TC-SO27–30 | Every Price chip |
| TC-SO31–47 | Text search, suggestions, combined filters |
| TC-SO48–57 | Card UI, photo/jar, View/Add/Wish/OOS/count |
| TC-SO58–60 | Hidden / custom active / custom draft |
| TC-SO61–68 | Complex multi-step flows |
| TC-SO69–72 | Mobile nav + all Shop now links |
| TC-SO73–79 | Contextual subtitles per concern |
| TC-SO80–96 | Query edge cases, herbs, Try suggestions |
| TC-SO97–106 | Filter matrix negatives + triple combos |
| TC-SO107–118 | Tags, from-price, stock limits, cart drawer, a11y |
| TC-SO119–128 | Hide/show catalog, custom discount/OOS |
| TC-SO129–150 | Complex edge flows (mega session, mobile, restock, QV) |

**Total: 150 browser E2E cases**

Also fixed real bugs found by tests:
- TC-SO58: hiding a built-in jar SKU no longer breaks `renderVals` / Search
- TC-SO134/135: Quick View now stacks above Search overlay (z-index) so buttons are clickable

```bash
npx playwright test tests/search-overlay.spec.js --headed
```

---

## Notes

- OTP and reset codes are read from `localStorage` (`ak_pending_otp`, `ak_reset`) — same as the demo UI toasts.
- Each test clears auth storage first to avoid cross-test pollution.
- Default test password: `Test@1234` (meets all strength rules).
- Passwords are stored as SHA-256 hex of `aakashik-demo|` + password (`pwHash`). Legacy plaintext entries migrate on successful sign-in.
