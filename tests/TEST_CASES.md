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

## Notes

- OTP and reset codes are read from `localStorage` (`ak_pending_otp`, `ak_reset`) — same as the demo UI toasts.
- Each test clears auth storage first to avoid cross-test pollution.
- Default test password: `Test@1234` (meets all strength rules).
