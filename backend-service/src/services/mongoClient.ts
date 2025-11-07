import { MongoClient } from 'mongodb';
import { loadEnv } from '../config/env';

let client: any = null;
let db: any = null;
let connectionPromise: Promise<any> | null = null;

export async function getDb(): Promise<any> {
  if (db) return db;

  if (connectionPromise) {
    await connectionPromise;
    return db;
  }

  const env = loadEnv();
  connectionPromise = (async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    db = client.db(env.MONGO_DB);
  })();

  try {
    await connectionPromise;
  } finally {
    connectionPromise = null;
  }

  return db;
}

export async function pingMongo(): Promise<boolean> {
  const env = loadEnv();
  const tempClient = new MongoClient(env.MONGO_URI);
  try {
    await tempClient.connect();
    await tempClient.db('admin').command({ ping: 1 });
    return true;
  } finally {
    await tempClient.close();
  }
}

export async function closeMongo(): Promise<void> {
  try {
    if (client) await client.close();
  } finally {
    client = null;
    db = null;
    connectionPromise = null;
  }
}
