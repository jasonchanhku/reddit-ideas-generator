import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

export function getMongoClient(uri: string): MongoClient {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri);
  }
  return global._mongoClient;
}
