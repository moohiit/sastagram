import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Push', () => {
  describe('GET /api/v1/push/public-key', () => {
    it('reports push disabled when VAPID keys are not configured', async () => {
      const res = await request(app).get('/api/v1/push/public-key');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enabled).toBe(false);
      expect(res.body.key).toBeUndefined();
    });
  });
});
