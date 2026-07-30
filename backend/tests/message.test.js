import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
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
