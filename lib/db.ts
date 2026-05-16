import { setServers } from "node:dns/promises";

setServers(["1.1.1.1", "8.8.8.8"]);
import { MongoClient, Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

async function createConnectedClient(uri: string): Promise<MongoClient> {
  // Set DNS servers in the same execution context as the SRV lookup
  await setServers(["8.8.8.8", "1.1.1.1"]);
  const client = new MongoClient(uri);
  return client.connect();
}

function getClientPromise(uri: string): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createConnectedClient(uri).catch((err) => {
      // Clear so the next request retries rather than reusing the rejected promise
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
