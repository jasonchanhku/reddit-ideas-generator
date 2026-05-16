import dns from "dns";
import { MongoClient, Db } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(uri: string): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

export async function getDb(uri: string, dbName: string): Promise<Db> {
  const client = await getClientPromise(uri);
  return client.db(dbName);
}
