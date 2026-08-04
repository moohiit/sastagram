import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { Comment } from '../models/comment.model.js';
import { createUserAndLogin } from './helpers.js';

let alice; // post author
let bob; // commenter

const makePost = () =>
  Post.create({
    caption: 'thread test',
    image: 'https://example.com/t.jpg',
    author: alice.user._id,
  });

beforeAll(async () => {
  alice = await createUserAndLogin({ username: 'threadalice', email: 'threadalice@example.com' });
  bob = await createUserAndLogin({ username: 'threadbob', email: 'threadbob@example.com' });
});

describe('comment replies', () => {
  it('creates a reply attached to its parent, and replies-to-replies attach to the top level', async () => {
    const post = await makePost();
    const top = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', alice.cookie)
      .send({ text: 'top level' });
    expect(top.status).toBe(201);
    expect(top.body.comment.parent).toBeNull();

    const reply = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', bob.cookie)
      .send({ text: 'a reply', parentId: top.body.comment._id });
    expect(reply.status).toBe(201);
    expect(reply.body.comment.parent).toBe(top.body.comment._id);

    // One-level threading: replying to the reply attaches to the top-level
    const nested = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', alice.cookie)
      .send({ text: 'nested reply', parentId: reply.body.comment._id });
    expect(nested.status).toBe(201);
    expect(nested.body.comment.parent).toBe(top.body.comment._id);
  });

  it('rejects a parent from a different post', async () => {
    const postA = await makePost();
    const postB = await makePost();
    const onA = await request(app)
      .post(`/api/v1/post/${postA._id}/comment`)
      .set('Cookie', alice.cookie)
      .send({ text: 'on A' });
    const res = await request(app)
      .post(`/api/v1/post/${postB._id}/comment`)
      .set('Cookie', bob.cookie)
      .send({ text: 'cross-post reply', parentId: onA.body.comment._id });
    expect(res.status).toBe(404);
  });

  it('deleting a parent removes its replies too', async () => {
    const post = await makePost();
    const top = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', alice.cookie)
      .send({ text: 'delete me' });
    const reply = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', bob.cookie)
      .send({ text: 'orphan-to-be', parentId: top.body.comment._id });

    const del = await request(app)
      .delete(`/api/v1/post/comment/${top.body.comment._id}`)
      .set('Cookie', alice.cookie);
    expect(del.status).toBe(200);
    expect(del.body.removedIds).toHaveLength(2);
    expect(await Comment.findById(reply.body.comment._id)).toBeNull();
  });
});

describe('comment likes', () => {
  it('toggles and exposes counts/flags, never the id array', async () => {
    const post = await makePost();
    const top = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', alice.cookie)
      .send({ text: 'like me' });
    const id = top.body.comment._id;

    const like = await request(app)
      .post(`/api/v1/post/comment/${id}/like`)
      .set('Cookie', bob.cookie);
    expect(like.status).toBe(200);
    expect(like.body.liked).toBe(true);
    expect(like.body.likesCount).toBe(1);

    const unlike = await request(app)
      .post(`/api/v1/post/comment/${id}/like`)
      .set('Cookie', bob.cookie);
    expect(unlike.body.liked).toBe(false);
    expect(unlike.body.likesCount).toBe(0);

    const list = await request(app)
      .get(`/api/v1/post/${post._id}/comment/all`)
      .set('Cookie', bob.cookie);
    expect(list.status).toBe(200);
    const shaped = list.body.comments.find((c) => c._id === id);
    expect(shaped.likesCount).toBe(0);
    expect(shaped.likedByMe).toBe(false);
    expect(shaped.likes).toBeUndefined();
  });
});
