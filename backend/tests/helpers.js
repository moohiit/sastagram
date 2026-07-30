import request from 'supertest';
import app from '../app.js';

export const PASSWORD = 'password123';

// Registers a user and logs them in, returning the auth cookie and the
// user object (including _id) from the login response.
export async function createUserAndLogin({ username, email }) {
  const reg = await request(app)
    .post('/api/v1/user/register')
    .send({ username, email, password: PASSWORD });
  if (reg.status !== 201) {
    throw new Error(`register failed (${reg.status}): ${JSON.stringify(reg.body)}`);
  }
  const res = await request(app)
    .post('/api/v1/user/login')
    .send({ email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { cookie: res.headers['set-cookie'], user: res.body.user };
}

export { app, request };
