import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** One in-memory single-node replica set per run (transactions need a replica set). */
export default async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.MONGODB_URI = replSet.getUri('riskquo-test');
};
