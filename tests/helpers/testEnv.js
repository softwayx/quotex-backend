// Fixed test secrets. MONGODB_URI comes from globalSetup (in-memory replica set) for integration tests.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:1/unit-tests-do-not-connect';
process.env.USER_SESSION_SECRET = 'test-user-session-secret-0123456789abcdef';
process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-0123456789abcdef';
process.env.APP_ENCRYPTION_KEY = '0f'.repeat(32);
process.env.WHATSAPP_ENABLED = 'false';
process.env.SITE_URL = 'http://localhost:3000';
