export const config = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET || 'aakashik-dev-secret-change-in-production',
  adminEmail: process.env.ADMIN_EMAIL || 'owner@aakashik.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@1234',
  dbPath: process.env.DB_PATH || 'data/aakashik.db',
  isTest: process.env.NODE_ENV === 'test',
};
