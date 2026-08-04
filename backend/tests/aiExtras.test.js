import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { createUserAndLogin } from './helpers.js';

let author;

beforeAll(async () => {
  author = await createUserAndLogin({ username: 'aixauthor', email: 'aixauthor@example.com' });
});

describe('GET /api/v1/post/:id/similar', () => {
  it('falls back to shared-hashtag posts when AI is disabled', async () => {
    await Post.deleteMany({});
    const base = await Post.create({
      caption: 'sunset walk #sunset',
      image: 'https://example.com/a.jpg',
      author: author.user._id,
      hashtags: ['sunset'],
    });
    const related = await Post.create({
      caption: 'another #sunset',
      image: 'https://example.com/b.jpg',
      author: author.user._id,
      hashtags: ['sunset'],
    });
    await Post.create({
      caption: 'unrelated #food',
      image: 'https://example.com/c.jpg',
      author: author.user._id,
      hashtags: ['food'],
    });

    const res = await request(app).get(`/api/v1/post/${base._id}/similar`);
    expect(res.status).toBe(200);
    const ids = res.body.posts.map((p) => p._id);
    expect(ids).toContain(related._id.toString());
    expect(ids).not.toContain(base._id.toString()); // never includes itself
    expect(ids).not.toContain(undefined);
  });

  it('falls back to the author feed when there are no hashtags', async () => {
    const plain = await Post.create({
      caption: 'no tags at all',
      image: 'https://example.com/d.jpg',
      author: author.user._id,
    });
    const res = await request(app).get(`/api/v1/post/${plain._id}/similar`);
    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBeGreaterThan(0);
    expect(res.body.posts.map((p) => p._id)).not.toContain(plain._id.toString());
  });
});

describe('POST /api/v1/ai/replies', () => {
  it('returns 503 when AI is not configured (test env)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/replies')
      .set('Cookie', author.cookie)
      .send({ messages: [{ fromMe: false, text: 'hey, dinner tonight?' }] });
    expect(res.status).toBe(503);
  });
});
