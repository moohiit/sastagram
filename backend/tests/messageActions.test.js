import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Message } from '../models/message.model.js';
import { createUserAndLogin } from './helpers.js';

let ana; // sender
let ben; // recipient
let eve; // outsider

const sendMessage = async () => {
  const res = await request(app)
    .post(`/api/v1/message/send/${ben.user._id}`)
    .set('Cookie', ana.cookie)
    .send({ message: 'react to this' });
  return res.body.newMessage;
};

beforeAll(async () => {
  ana = await createUserAndLogin({ username: 'reactana', email: 'reactana@example.com' });
  ben = await createUserAndLogin({ username: 'reactben', email: 'reactben@example.com' });
  eve = await createUserAndLogin({ username: 'reacteve', email: 'reacteve@example.com' });
});

describe('message reactions', () => {
  it('adds, replaces, and removes a reaction; outsiders are rejected', async () => {
    const msg = await sendMessage();

    const add = await request(app)
      .post(`/api/v1/message/${msg._id}/react`)
      .set('Cookie', ben.cookie)
      .send({ emoji: '❤️' });
    expect(add.status).toBe(200);
    expect(add.body.reactions).toHaveLength(1);
    expect(add.body.reactions[0].emoji).toBe('❤️');

    // Different emoji replaces (still one reaction per user)
    const replace = await request(app)
      .post(`/api/v1/message/${msg._id}/react`)
      .set('Cookie', ben.cookie)
      .send({ emoji: '🔥' });
    expect(replace.body.reactions).toHaveLength(1);
    expect(replace.body.reactions[0].emoji).toBe('🔥');

    // Same emoji toggles off
    const remove = await request(app)
      .post(`/api/v1/message/${msg._id}/react`)
      .set('Cookie', ben.cookie)
      .send({ emoji: '🔥' });
    expect(remove.body.reactions).toHaveLength(0);

    const outsider = await request(app)
      .post(`/api/v1/message/${msg._id}/react`)
      .set('Cookie', eve.cookie)
      .send({ emoji: '❤️' });
    expect(outsider.status).toBe(403);

    const badEmoji = await request(app)
      .post(`/api/v1/message/${msg._id}/react`)
      .set('Cookie', ben.cookie)
      .send({ emoji: 'nope' });
    expect(badEmoji.status).toBe(400);
  });
});

describe('unsend', () => {
  it('soft-deletes for the sender only', async () => {
    const msg = await sendMessage();

    const notMine = await request(app)
      .delete(`/api/v1/message/${msg._id}`)
      .set('Cookie', ben.cookie);
    expect(notMine.status).toBe(403);

    const unsent = await request(app)
      .delete(`/api/v1/message/${msg._id}`)
      .set('Cookie', ana.cookie);
    expect(unsent.status).toBe(200);

    const fresh = await Message.findById(msg._id);
    expect(fresh.deleted).toBe(true);
    expect(fresh.message).toBe('');

    // Already-unsent messages can no longer be reacted to
    const react = await request(app)
      .post(`/api/v1/message/${msg._id}/react`)
      .set('Cookie', ben.cookie)
      .send({ emoji: '❤️' });
    expect(react.status).toBe(404);
  });
});
