import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { createUserAndLogin } from './helpers.js';

let sender; // { cookie, user }
let receiver;

beforeAll(async () => {
  sender = await createUserAndLogin({ username: 'msgsender', email: 'sender@example.com' });
  receiver = await createUserAndLogin({ username: 'msgreceiver', email: 'receiver@example.com' });
});

describe('Messages', () => {
  it('sends a message', async () => {
    const res = await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ message: 'hello there' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.newMessage.message).toBe('hello there');
    expect(res.body.newMessage.senderId).toBe(sender.user._id);
    expect(res.body.newMessage.recieverId).toBe(receiver.user._id);
    expect(res.body.newMessage.read).toBe(false);
  });

  it('counts unread messages, then marks them read when the thread is opened', async () => {
    await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ message: 'second message' });

    // Receiver has unread messages from sender
    const unreadBefore = await request(app)
      .get('/api/v1/message/unread')
      .set('Cookie', receiver.cookie);
    expect(unreadBefore.status).toBe(200);
    expect(unreadBefore.body.unread[sender.user._id]).toBe(2);

    // Opening the thread returns the messages and marks them read
    const thread = await request(app)
      .get(`/api/v1/message/all/${sender.user._id}`)
      .set('Cookie', receiver.cookie);
    expect(thread.status).toBe(200);
    expect(thread.body.messages).toHaveLength(2);
    expect(thread.body.messages.map((m) => m.message)).toEqual([
      'hello there',
      'second message',
    ]);
    for (const m of thread.body.messages) {
      expect(m.read).toBe(true);
    }

    // Unread counts are now empty
    const unreadAfter = await request(app)
      .get('/api/v1/message/unread')
      .set('Cookie', receiver.cookie);
    expect(unreadAfter.status).toBe(200);
    expect(unreadAfter.body.unread[sender.user._id]).toBeUndefined();
  });
});

describe('Share post to DM', () => {
  let post;

  beforeAll(async () => {
    // Create the post directly via the model (the HTTP addpost path uploads
    // to Cloudinary, which tests must not touch).
    post = await Post.create({
      caption: 'a shareable post',
      image: 'https://example.com/shared-image.jpg',
      author: receiver.user._id,
    });
  });

  it('shares a post (no text) and returns the populated post', async () => {
    const res = await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ postId: post._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.newMessage.post._id).toBe(post._id.toString());
    expect(res.body.newMessage.post.image).toBe('https://example.com/shared-image.jpg');
    expect(res.body.newMessage.post.caption).toBe('a shareable post');
    expect(res.body.newMessage.post.author.username).toBe('msgreceiver');
  });

  it('shares a post with accompanying text', async () => {
    const res = await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ message: 'check this out', postId: post._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.newMessage.message).toBe('check this out');
    expect(res.body.newMessage.post._id).toBe(post._id.toString());
  });

  it('rejects sharing a non-existent post', async () => {
    const res = await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ postId: post._id.toString().replace(/./g, '0') });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rejects a message with neither text nor post', async () => {
    const res = await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('populates the shared post when fetching the thread; text-only messages still work', async () => {
    const textOnly = await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ message: 'plain text still works' });
    expect(textOnly.status).toBe(201);
    expect(textOnly.body.newMessage.post).toBeUndefined();

    const thread = await request(app)
      .get(`/api/v1/message/all/${sender.user._id}`)
      .set('Cookie', receiver.cookie);
    expect(thread.status).toBe(200);
    const shared = thread.body.messages.find((m) => m.post && !m.message);
    expect(shared).toBeTruthy();
    expect(shared.post.image).toBe('https://example.com/shared-image.jpg');
    expect(shared.post.author.username).toBe('msgreceiver');
    const plain = thread.body.messages.find((m) => m.message === 'plain text still works');
    expect(plain).toBeTruthy();
    expect(plain.post).toBeUndefined();
  });

  it('previews "Shared a post" in the conversation list', async () => {
    // The most recent message in the thread is text-only, so share once more.
    await request(app)
      .post(`/api/v1/message/send/${receiver.user._id}`)
      .set('Cookie', sender.cookie)
      .send({ postId: post._id.toString() });

    const res = await request(app)
      .get('/api/v1/message/conversations')
      .set('Cookie', receiver.cookie);
    expect(res.status).toBe(200);
    const convo = res.body.conversations.find((c) => c._id === sender.user._id);
    expect(convo).toBeTruthy();
    expect(convo.lastMessage).toBe('Shared a post');
  });
});
