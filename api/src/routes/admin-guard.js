import { requireAdmin } from '../services/auth.js';

export async function adminPreHandler(request) {
  requireAdmin(request);
}
