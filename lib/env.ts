import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.replace(/\/+$/, "") : undefined))
  .refine((value) => !value || /^https?:\/\//.test(value), {
    message: "Expected a valid URL",
  });

const serverEnvSchema = z.object({
  DECODO_API_KEY: z.string().trim().min(1, "DECODO_API_KEY is required"),
  OPENAI_API_KEY: z.string().trim().min(1, "OPENAI_API_KEY is required"),
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_MODEL: z.string().trim().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  MONGODB_URI: z.string().trim().optional(),
  MONGODB_DB_NAME: z.string().trim().optional(),
  MONGODB_COLLECTION: z.string().trim().optional(),
  DECODO_PROXY_POOL: z.string().trim().optional(),
  DECODO_HEADLESS_MODE: z.string().trim().optional(),
  DECODO_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
});

export type ServerEnv = {
  decodoApiKey: string;
  decodoProxyPool: string;
  decodoHeadlessMode: string;
  decodoTimeoutMs: number;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiTimeoutMs: number;
  mongodbUri?: string;
  mongodbDbName: string;
  mongodbCollection: string;
};

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsedEnv = serverEnvSchema.parse({
    DECODO_API_KEY: process.env.DECODO_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    MONGODB_COLLECTION: process.env.MONGODB_COLLECTION,
    DECODO_PROXY_POOL: process.env.DECODO_PROXY_POOL,
    DECODO_HEADLESS_MODE: process.env.DECODO_HEADLESS_MODE,
    DECODO_TIMEOUT_MS: process.env.DECODO_TIMEOUT_MS,
  });

  cachedEnv = {
    decodoApiKey: parsedEnv.DECODO_API_KEY,
    decodoProxyPool: parsedEnv.DECODO_PROXY_POOL || "premium",
    decodoHeadlessMode: parsedEnv.DECODO_HEADLESS_MODE || "html",
    decodoTimeoutMs: parsedEnv.DECODO_TIMEOUT_MS ?? 20000,
    openaiApiKey: parsedEnv.OPENAI_API_KEY,
    openaiBaseUrl: parsedEnv.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiModel: parsedEnv.OPENAI_MODEL ?? "gpt-4o-mini",
    openaiTimeoutMs: parsedEnv.OPENAI_TIMEOUT_MS ?? 90000,
    mongodbUri: parsedEnv.MONGODB_URI || undefined,
    mongodbDbName: parsedEnv.MONGODB_DB_NAME || "validly",
    mongodbCollection: parsedEnv.MONGODB_COLLECTION || "ideas",
  };

  return cachedEnv;
}
