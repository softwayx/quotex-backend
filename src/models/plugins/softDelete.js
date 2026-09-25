/**
 * Paranoid soft delete for every collection (like Sequelize `paranoid: true, deletedAt: 'deletedAt'`).
 * Queries skip rows whose `deletedAt` is set; pass `{ withDeleted: true }` as a query option to see them.
 */
const QUERY_OPS = [
  'find',
  'findOne',
  'countDocuments',
  'distinct',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];

export default function softDelete(schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  function skipDeleted() {
    if (this.getOptions().withDeleted || 'deletedAt' in this.getFilter()) return;
    this.where({ deletedAt: null });
  }
  for (const op of QUERY_OPS) schema.pre(op, skipDeleted);

  schema.pre('aggregate', function skipDeletedInAggregate() {
    if (!this.options.withDeleted) this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  schema.statics.softDelete = function softDeleteMany(filter, options = {}) {
    return this.updateMany(filter, { $set: { deletedAt: new Date() } }, options);
  };
}
