/**
 * Reset API commerce fixtures during Playwright runs (requires AAKASHIK_E2E=1).
 */
async function resetE2eApi(request) {
  const res = await request.post('/api/e2e/reset');
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`E2E API reset failed (${res.status()}): ${body}`);
  }
}

module.exports = { resetE2eApi };
