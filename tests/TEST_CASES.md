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

## Ritual reminder edit / add another (`tests/ux-reminder.spec.js`)

| ID | Focus | Type |
|----|--------|------|
| TC-RM01 | Edit reminder reopens form with saved values | + |
| TC-RM02 | Edit updates saved reminder (product + contact) | + |
| TC-RM03 | Add another shows a fresh form | + |
| TC-RM04 | Add another saves a second powder reminder | + |
| TC-RM05 | Invalid WhatsApp contact still blocked after Add another | − |
| TC-RM06 | Success panel shows Edit and Add another after reload | + |

---

## Notes

- OTP and reset codes are read from `localStorage` (`ak_pending_otp`, `ak_reset`) — same as the demo UI toasts.
- Each test clears auth storage first to avoid cross-test pollution.
- Default test password: `Test@1234` (meets all strength rules).
- Passwords are stored as SHA-256 hex of `aakashik-demo|` + password (`pwHash`). Legacy plaintext entries migrate on successful sign-in.
