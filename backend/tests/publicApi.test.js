import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { Comment } from '../models/comment.model.js';
import { Like } from '../models/like.model.js';
import { createUserAndLogin } from './helpers.js';

// The public API is unauthenticated by design — no request in this file
// sends a cookie.

let author; // { cookie, user }
let liker;

const PUBLIC_POST_KEYS = [
  'id',
  'caption',
  'image',
  'mediaType',
  'altText',
  'likeCount',
  'commentCount',
  'createdAt',
  'author',
].sort();

const makePost = (caption, extra = {}) =>
  Post.create({
    caption,
    image: 'https://example.com/fake-image.jpg',
    author: author.user._id,
    ...extra,
  });

beforeAll(async () => {
  author = await createUserAndLogin({ username: 'pubauthor', email: 'pubauthor@example.com' });
  liker = await createUserAndLogin({ username: 'publiker', email: 'publiker@example.com' });
});

describe('GET /api/public/v1/posts', () => {
  it('returns the public shape only — counts, no likes/comments/embedding arrays', async () => {
    await Post.deleteMany({});
    const post = await makePost('shape check', {
      embedding: [0.1, 0.2, 0.3],
      altText: 'a test image',
    });
    // Like counts are read from the Like collection (Stage 3)
    await Like.create({ user: liker.user._id, post: post._id });
    const comment = await Comment.create({
      text: 'internal comment body',
      author: liker.user._id,
      post: post._id,
    });
    post.comments.push(comment._id);
    await post.save();

    const res = await request(app).get('/api/public/v1/posts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.posts).toHaveLength(1);

    const p = res.body.posts[0];
    expect(Object.keys(p).sort()).toEqual(PUBLIC_POST_KEYS);
    expect(p.id).toBe(post._id.toString());
    expect(p.caption).toBe('shape check');
    expect(p.altText).toBe('a test image');
    expect(p.likeCount).toBe(1);
    expect(p.commentCount).toBe(1);
    // Internal fields must never leak
    expect(p.likes).toBeUndefined();
    expect(p.embedding).toBeUndefined();
    expect(p._id).toBeUndefined();
    // Author is username + profilePicture only (no id, email, password, ...)
    expect(Object.keys(p.author).sort()).toEqual(['profilePicture', 'username']);
    expect(p.author.username).toBe('pubauthor');
    expect(JSON.stringify(res.body)).not.toContain('internal comment body');
  });

  it('paginates with cursor and caps limit at 20', async () => {
    await Post.deleteMany({});
    for (let i = 1; i <= 25; i++) {
      await makePost(`feed post ${i}`);
    }

    // limit=100 must be clamped to 20
    const page1 = await request(app).get('/api/public/v1/posts?limit=100');
    expect(page1.status).toBe(200);
    expect(page1.body.posts).toHaveLength(20);
    expect(page1.body.nextCursor).toBeTruthy();
    expect(page1.body.posts[0].caption).toBe('feed post 25'); // newest first

    const page2 = await request(app).get(
      `/api/public/v1/posts?limit=100&cursor=${page1.body.nextCursor}`
    );
    expect(page2.status).toBe(200);
    expect(page2.body.posts).toHaveLength(5);
    expect(page2.body.nextCursor).toBeNull();
    expect(page2.body.posts[4].caption).toBe('feed post 1');
  });

  it('rejects a malformed cursor with 400', async () => {
    const res = await request(app).get('/api/public/v1/posts?cursor=not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/public/v1/posts/:id', () => {
  it('returns a single post in the public shape', async () => {
    const post = await makePost('single lookup');
    const res = await request(app).get(`/api/public/v1/posts/${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.post).sort()).toEqual(PUBLIC_POST_KEYS);
    expect(res.body.post.id).toBe(post._id.toString());
    expect(res.body.post.commentCount).toBe(0);
    expect(res.body.post.likes).toBeUndefined();
  });

  it('404s for an unknown or malformed post id', async () => {
    const missing = await request(app).get(
      `/api/public/v1/posts/${new mongoose.Types.ObjectId()}`
    );
    expect(missing.status).toBe(404);
    const malformed = await request(app).get('/api/public/v1/posts/nope');
    expect(malformed.status).toBe(404);
  });
});

describe('GET /api/public/v1/users/:username', () => {
  it('returns the public profile with counts only', async () => {
    const res = await request(app).get('/api/public/v1/users/pubauthor');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.user).sort()).toEqual([
      'bio',
      'counts',
      'profilePicture',
      'username',
    ]);
    expect(res.body.user.username).toBe('pubauthor');
    expect(res.body.user.counts.followers).toBe(0);
    expect(res.body.user.counts.following).toBe(0);
    expect(typeof res.body.user.counts.posts).toBe('number');
    // Never leak credentials or id arrays
    expect(JSON.stringify(res.body)).not.toContain('pubauthor@example.com');
  });

  it('404s for an unknown username', async () => {
    const res = await request(app).get('/api/public/v1/users/no-such-user');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/public/v1/search/posts', () => {
  it('falls back to text search unauthenticated and returns the public shape', async () => {
    await Post.deleteMany({});
    await makePost('a golden retriever puppy');
    await makePost('city skyline at night');

    // AI is disabled in tests (setup.js deletes GEMINI_API_KEY), so the
    // regex fallback must serve the results with mode "text".
    const res = await request(app).get('/api/public/v1/search/posts?q=RETRIEVER');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('text');
    expect(res.body.posts).toHaveLength(1);
    expect(Object.keys(res.body.posts[0]).sort()).toEqual(PUBLIC_POST_KEYS);
    expect(res.body.posts[0].caption).toBe('a golden retriever puppy');
  });

  it('returns an empty result set for an empty query', async () => {
    const res = await request(app).get('/api/public/v1/search/posts');
    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
    expect(res.body.mode).toBe('text');
  });
});

describe('GET /api/public/docs', () => {
  it('serves the swagger UI', async () => {
    const res = await request(app).get('/api/public/docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
