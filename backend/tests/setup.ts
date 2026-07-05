import { beforeAll, afterAll } from 'bun:test';
import { connectDB, disconnectDB } from '../src/config/db';
import { loadEnv } from '../src/config/env';

beforeAll(async () => {
  loadEnv();
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});
