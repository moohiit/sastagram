import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createUserAndLogin, PASSWORD } from './helpers.js';

describe('Auth', () => {
  describe('POST /api/v1/user/register', () => {
    it('registers a new user', async () => {
      const res = await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'alice', email: 'alice@example.com', password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects a duplicate username with 409', async () => {
      await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'dupuser', email: 'dup1@example.com', password: PASSWORD });
      const res = await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'dupuser', email: 'dup2@example.com', password: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects an invalid email with 400', async () => {
      const res = await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'bademail', email: 'not-an-email', password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects a short password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'shortpw', email: 'shortpw@example.com', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 8/i);
    });

    it('rejects NoSQL-injection object payloads with 400', async () => {
      const res = await request(app)
        .post('/api/v1/user/register')
        .send({
          username: { $gt: '' },
          email: { $gt: '' },
          password: { $gt: '' },
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/user/login', () => {
    it('logs in and sets an httpOnly auth cookie', async () => {
      await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'loginuser', email: 'login@example.com', password: PASSWORD });
      const res = await request(app)
        .post('/api/v1/user/login')
        .send({ email: 'login@example.com', password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('loginuser');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find((c) => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
    });

    it('rejects a wrong password with 401', async () => {
      await request(app)
        .post('/api/v1/user/register')
        .send({ username: 'wrongpw', email: 'wrongpw@example.com', password: PASSWORD });
      const res = await request(app)
        .post('/api/v1/user/login')
        .send({ email: 'wrongpw@example.com', password: 'incorrect-password' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/user/me', () => {
    it('returns 401 without a cookie', async () => {
      const res = await request(app).get('/api/v1/user/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns the current user with a valid cookie', async () => {
      const { cookie, user } = await createUserAndLogin({
        username: 'meuser',
        email: 'me@example.com',
      });
      const res = await request(app).get('/api/v1/user/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user._id).toBe(user._id);
      expect(res.body.user.username).toBe('meuser');
      expect(res.body.user.password).toBeUndefined();
    });
  });
});
