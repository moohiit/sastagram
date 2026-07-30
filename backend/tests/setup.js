import { beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Must be set before backend/app.js is imported by any test file:
// NODE_ENV=test disables rate limiting, JWT_SECRET is needed to sign/verify
// auth cookies. Cloudinary vars are intentionally absent — no test may hit it.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vitest-jwt-secret';
process.env.URL = 'http://localhost:5173';

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
