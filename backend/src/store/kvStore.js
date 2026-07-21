'use strict';
const { Redis } = require('@upstash/redis');
const { env } = require('../config/env');

/**
 * Upstash Redis store (HTTP-based → no connection pooling issues on serverless).
 * Layout:
 *   doc:{collection}:{id}   -> JSON document
 *   idx:{collection}        -> Set of ids in the collection
 * findAll/findOne read the index set then MGET; filtering is done in-process
 * (fine at hackathon/demo scale).
 */
function createKvStore() {
  const redis = new Redis({ url: env.store.upstashUrl, token: env.store.upstashToken });
  const docKey = (c, id) => `doc:${c}:${id}`;
  const idxKey = (c) => `idx:${c}`;

  async function loadAll(collection) {
    const ids = await redis.smembers(idxKey(collection));
    if (!ids || ids.length === 0) return [];
    const keys = ids.map((id) => docKey(collection, id));
    const vals = await redis.mget(...keys);
    return vals.filter(Boolean).map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
  }

  return {
    driver: 'kv',
    // Atomic monotonic counter via Redis INCR — safe across concurrent serverless invocations.
    async incr(key) {
      return await redis.incr('ctr:' + key);
    },
    async create(collection, doc) {
      await redis.set(docKey(collection, doc.id), JSON.stringify(doc));
      await redis.sadd(idxKey(collection), doc.id);
      return doc;
    },
    async findById(collection, id) {
      const v = await redis.get(docKey(collection, id));
      return v == null ? null : typeof v === 'string' ? JSON.parse(v) : v;
    },
    async findAll(collection, filter) {
      const all = await loadAll(collection);
      return filter ? all.filter(filter) : all;
    },
    async findOne(collection, filter) {
      const all = await loadAll(collection);
      return all.find(filter) || null;
    },
    async update(collection, id, patch) {
      const cur = await this.findById(collection, id);
      if (!cur) return null;
      const next = { ...cur, ...patch, id, updatedAt: new Date().toISOString() };
      await redis.set(docKey(collection, id), JSON.stringify(next));
      return next;
    },
    async remove(collection, id) {
      await redis.del(docKey(collection, id));
      await redis.srem(idxKey(collection), id);
      return true;
    },
    async reset() {
      // No-op safeguard; intentionally not flushing the whole Redis instance.
    },
  };
}

module.exports = { createKvStore };
