import { setServers } from "node:dns/promises";
import { MongoClient, Db } from "mongodb";

// MongoDB driver uses dns/promises for SRV lookups; configure resolvers at module load
setServers(["1.1.1.1", "8.8.8.8"]);

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(uri: string): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect().catch((err) => {
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export async function getDb(uri: string, dbName: string): Promise<Db> {
  const client = await getClientPromise(uri);
  return client.db(dbName);
}
