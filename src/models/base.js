import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import softDelete from './plugins/softDelete.js';

/** Unique indexes only count rows that are not soft-deleted. */
export const ALIVE = { deletedAt: { $type: 'null' } };

/** `_id` of the single settings document in the singleton collections. */
export const SINGLETON_ID = 'default';

/**
 * Every collection: UUID `_id` (exposed as `id`, same ids as the old Postgres rows), `created_at` /
 * `updated_at`, soft delete, and a hidden `lock_seq` bumped by `lockDoc` to serialise writers.
 */
export const defineModel = (name, collection, fields, indexes = []) => {
  const schema = new mongoose.Schema(
    { _id: { type: String, default: () => randomUUID() }, ...fields, lock_seq: { type: Number, select: false } },
    { collection, versionKey: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
  );
  schema.plugin(softDelete);
  for (const [spec, options] of indexes) schema.index(spec, options);
  return mongoose.models[name] ?? mongoose.model(name, schema);
};

/** Plain object with `id` instead of `_id`, like a row from the old database. */
export const toRow = (doc) => {
  if (!doc) return null;
  const { _id, deletedAt: _deleted, lock_seq: _lock, ...rest } = doc.toObject ? doc.toObject() : doc;
  return { id: _id, ...rest };
};

/**
 * Takes a write lock on one document inside a transaction (the `SELECT ... FOR UPDATE` of the old app):
 * a concurrent transaction touching the same document conflicts and is retried after this one commits.
 */
export const lockDoc = async (Model, filter, session, options = {}) =>
  toRow(await Model.findOneAndUpdate(filter, { $inc: { lock_seq: 1 } }, { returnDocument: 'after', session, lean: true, ...options }));
