import { beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Must be set before backend/app.js is imported by any test file:
// NODE_ENV=test disables rate limiting, JWT_SECRET is needed to sign/verify
// auth cookies. Cloudinary vars are intentionally absent — no test may hit it.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vitest-jwt-secret';
process.env.URL = 'http://localhost:5173';
// AI must be disabled in tests: no test may hit the Gemini API, and search
// tests assert the text-fallback path.
delete process.env.GEMINI_API_KEY;
// Web push must be disabled in tests: no test may hit a push service.
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
