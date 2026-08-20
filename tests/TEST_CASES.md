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
