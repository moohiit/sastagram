import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { createUserAndLogin } from './helpers.js';

let author; // { cookie, user }
let other; // second user, for authorization checks

beforeAll(async () => {
  author = await createUserAndLogin({ username: 'postauthor', email: 'author@example.com' });
  other = await createUserAndLogin({ username: 'otheruser', email: 'other@example.com' });
});

// Create a post directly via the model (the HTTP addpost path uploads to
// Cloudinary, which tests must not touch).
const makePost = (caption) =>
  Post.create({
    caption,
    image: 'https://example.com/fake-image.jpg',
    author: author.user._id,
  });

describe('GET /api/v1/post/all pagination', () => {
  it('returns 10 posts + nextCursor, then the remaining 5 with a null cursor', async () => {
    await Post.deleteMany({});
    for (let i = 1; i <= 15; i++) {
      await makePost(`post ${i}`);
    }

    const page1 = await request(app).get('/api/v1/post/all').set('Cookie', author.cookie);
    expect(page1.status).toBe(200);
    expect(page1.body.posts).toHaveLength(10);
    expect(page1.body.nextCursor).toBeTruthy();
    // Newest first
    expect(page1.body.posts[0].caption).toBe('post 15');

    const page2 = await request(app)
      .get(`/api/v1/post/all?cursor=${page1.body.nextCursor}`)
      .set('Cookie', author.cookie);
    expect(page2.status).toBe(200);
    expect(page2.body.posts).toHaveLength(5);
    expect(page2.body.nextCursor).toBeNull();
    expect(page2.body.posts[4].caption).toBe('post 1');

    // No overlap between pages
    const ids1 = page1.body.posts.map((p) => p._id);
    const ids2 = page2.body.posts.map((p) => p._id);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
  });
});

describe('like / dislike', () => {
  it('likes then dislikes a post', async () => {
    const post = await makePost('likeable');

    const like = await request(app)
      .get(`/api/v1/post/${post._id}/like`)
      .set('Cookie', other.cookie);
    expect(like.status).toBe(200);
    expect(like.body.success).toBe(true);
    let fresh = await Post.findById(post._id);
    expect(fresh.likes.map(String)).toContain(other.user._id);

    const dislike = await request(app)
      .get(`/api/v1/post/${post._id}/dislike`)
      .set('Cookie', other.cookie);
    expect(dislike.status).toBe(200);
    fresh = await Post.findById(post._id);
    expect(fresh.likes.map(String)).not.toContain(other.user._id);
  });
});

describe('comments', () => {
  it('adds a comment', async () => {
    const post = await makePost('commentable');
    const res = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', other.cookie)
      .send({ text: 'nice post' });
    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('nice post');
    expect(res.body.comment.author.username).toBe('otheruser');
  });

  it('forbids a non-author (non-post-owner) from deleting a comment', async () => {
    const post = await makePost('protected comments');
    const created = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', author.cookie)
      .send({ text: 'my own comment' });
    const commentId = created.body.comment._id;

    // "other" is neither the comment author nor the post owner
    const res = await request(app)
      .delete(`/api/v1/post/comment/${commentId}`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // The comment author can delete it
    const ok = await request(app)
      .delete(`/api/v1/post/comment/${commentId}`)
      .set('Cookie', author.cookie);
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
  });
});

describe('PUT /api/v1/post/:id/caption', () => {
  it('forbids a non-author from editing the caption', async () => {
    const post = await makePost('original caption');
    const res = await request(app)
      .put(`/api/v1/post/${post._id}/caption`)
      .set('Cookie', other.cookie)
      .send({ caption: 'hijacked' });
    expect(res.status).toBe(403);
    const fresh = await Post.findById(post._id);
    expect(fresh.caption).toBe('original caption');
  });

  it('lets the author edit the caption', async () => {
    const post = await makePost('before edit');
    const res = await request(app)
      .put(`/api/v1/post/${post._id}/caption`)
      .set('Cookie', author.cookie)
      .send({ caption: 'after edit' });
    expect(res.status).toBe(200);
    expect(res.body.post.caption).toBe('after edit');
  });
});
