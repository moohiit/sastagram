import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { Like } from '../models/like.model.js';
import { createUserAndLogin } from './helpers.js';

let author;
let fans = [];

beforeAll(async () => {
  author = await createUserAndLogin({ username: 'expauthor', email: 'expauthor@example.com' });
  fans = await Promise.all([
    createUserAndLogin({ username: 'expfan1', email: 'expfan1@example.com' }),
    createUserAndLogin({ username: 'expfan2', email: 'expfan2@example.com' }),
    createUserAndLogin({ username: 'expfan3', email: 'expfan3@example.com' }),
  ]);
});

describe('GET /api/v1/post/explore', () => {
  it('ranks an engaged older post above a fresh unengaged one', async () => {
    await Post.deleteMany({});
    await Like.deleteMany({});
    const hot = await Post.create({
      caption: 'engaged post',
      image: 'https://example.com/hot.jpg',
      author: author.user._id,
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1h old
    });
    await Like.create(fans.map((f) => ({ user: f.user._id, post: hot._id })));
    const fresh = await Post.create({
      caption: 'brand new, no likes',
      image: 'https://example.com/fresh.jpg',
      author: author.user._id,
    });

    const res = await request(app)
      .get('/api/v1/post/explore')
      .set('Cookie', fans[0].cookie);
    expect(res.status).toBe(200);
    const ids = res.body.posts.map((p) => p._id);
    expect(ids.indexOf(hot._id.toString())).toBeLessThan(ids.indexOf(fresh._id.toString()));

    const hotRow = res.body.posts.find((p) => p._id === hot._id.toString());
    expect(hotRow.likesCount).toBe(3);
    expect(hotRow.likedByMe).toBe(true);
    expect(hotRow.likes).toBeUndefined();
    expect(hotRow.embedding).toBeUndefined();
  });
});
