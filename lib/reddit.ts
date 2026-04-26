import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import { getServerEnv } from "@/lib/env";
import type { RedditPost, StructuredRedditData } from "@/lib/types";

const DECODO_ENDPOINT = "https://scraper-api.decodo.com/v2/scrape";
const MAX_POSTS = 8;
const MAX_COMMENTS = 3;
const COMMENT_FETCH_CONCURRENCY = 4;
const MAX_TITLE_LENGTH = 180;
const MAX_COMMENT_LENGTH = 320;

type DecodoStrategy = {
  name: string;
  headers: (apiKey: string) => HeadersInit;
  body: (url: string, proxyPool: string, headlessMode: string) => Record<string, unknown>;
};

function buildDecodoAuthorizationHeader(apiKey: string): string {
  if (/^(Basic|Bearer)\s+/i.test(apiKey)) {
    return apiKey;
  }

  return `Basic ${apiKey}`;
}

const decodoStrategies: DecodoStrategy[] = [
  {
    name: "web-scraping-api-fast",
    headers: (apiKey) => ({ Authorization: buildDecodoAuthorizationHeader(apiKey) }),
    body: (url, proxyPool) => ({
      url,
      proxy_pool: proxyPool,
    }),
  },
  {
    name: "web-scraping-api",
    headers: (apiKey) => ({ Authorization: buildDecodoAuthorizationHeader(apiKey) }),
    body: (url, proxyPool, headlessMode) => ({
      url,
      proxy_pool: proxyPool,
      headless: headlessMode,
    }),
  },
  {
    name: "web-scraping-api-render-flag",
    headers: (apiKey) => ({
      Authorization: buildDecodoAuthorizationHeader(apiKey),
    }),
    body: (url, proxyPool, headlessMode) => ({
      url,
      proxy_pool: proxyPool,
      headless: headlessMode,
      render: true,
    }),
  },
];

let cachedStrategyIndex: number | null = null;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimText(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function toAbsoluteRedditUrl(href: string): string {
  if (/^https?:\/\//.test(href)) {
    return href;
  }

  return `https://www.reddit.com${href.startsWith("/") ? href : `/${href}`}`;
}

function toScrapeableRedditUrl(href: string): string {
  const absoluteUrl = toAbsoluteRedditUrl(href);

  try {
    const url = new URL(absoluteUrl);
    url.hostname = "old.reddit.com";
    return url.toString();
  } catch {
    return absoluteUrl.replace("www.reddit.com", "old.reddit.com");
  }
}

function normalizePermalink(href: string): string {
  const absoluteUrl = toAbsoluteRedditUrl(href);

  try {
    const url = new URL(absoluteUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return absoluteUrl;
  }
}

function extractHtmlCandidate(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("<") && trimmed.includes("html")) {
      return trimmed;
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const commonKeys = [
    "html",
    "content",
    "body",
    "result",
    "results",
    "data",
    "response",
    "source",
  ];

  for (const key of commonKeys) {
    const html = extractHtmlCandidate(record[key]);
    if (html) {
      return html;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const html = extractHtmlCandidate(nestedValue);
    if (html) {
      return html;
    }
  }

  return null;
}

async function requestDecodo(url: string, strategy: DecodoStrategy): Promise<string> {
  const { decodoApiKey, decodoProxyPool, decodoHeadlessMode, decodoTimeoutMs } = getServerEnv();
  const response = await fetch(DECODO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      ...strategy.headers(decodoApiKey),
    },
    body: JSON.stringify(strategy.body(url, decodoProxyPool, decodoHeadlessMode)),
    cache: "no-store",
    signal: AbortSignal.timeout(decodoTimeoutMs),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Decodo request failed (${strategy.name}): ${response.status} ${rawText.slice(0, 180)}`,
    );
  }

  if (rawText.trim().startsWith("<")) {
    return rawText;
  }

  let payload: unknown = rawText;

  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = rawText;
  }

  const html = extractHtmlCandidate(payload);

  if (!html) {
    throw new Error(`Decodo returned a response without HTML content using ${strategy.name}.`);
  }

  return html;
}

async function scrapeUrl(url: string): Promise<string> {
  const strategyOrder = cachedStrategyIndex === null
    ? decodoStrategies.map((_, index) => index)
    : [cachedStrategyIndex, ...decodoStrategies.map((_, index) => index).filter((index) => index !== cachedStrategyIndex)];

  const failures: string[] = [];

  for (const index of strategyOrder) {
    const strategy = decodoStrategies[index];

    try {
      const html = await requestDecodo(url, strategy);
      cachedStrategyIndex = index;
      return html;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Unknown Decodo error");
    }
  }

  throw new Error(`Unable to fetch HTML from Decodo. ${failures.join(" | ")}`);
}

function extractTitleFromNode($: cheerio.CheerioAPI, element: AnyNode): string {
  const node = $(element);
  const titledElement = node.find("h3, .title a, [slot='title'], a[data-click-id='body'], a h3").first();
  const explicitText = trimText(titledElement.text() || node.attr("post-title") || "", MAX_TITLE_LENGTH);

  if (explicitText) {
    return explicitText;
  }

  const linkText = trimText(
    node.find("a[href*='/comments/']").first().text() || node.text(),
    MAX_TITLE_LENGTH,
  );

  return linkText;
}

function extractPermalinkFromNode(
  $: cheerio.CheerioAPI,
  element: AnyNode,
): string | null {
  const node = $(element);
  const permalink =
    node.attr("permalink") ||
    node.attr("content-href") ||
    node.attr("data-permalink") ||
    node.find("a[href*='/comments/']").first().attr("href") ||
    null;

  return permalink ? normalizePermalink(permalink) : null;
}

function extractPostCandidates(html: string): Array<{ title: string; permalink: string }> {
  const $ = cheerio.load(html);
  const candidates: Array<{ title: string; permalink: string }> = [];
  const seenPermalinks = new Set<string>();

  const collect = (selector: string) => {
    $(selector).each((_, element) => {
      const title = extractTitleFromNode($, element);
      const permalink = extractPermalinkFromNode($, element);

      if (!title || !permalink) {
        return;
      }

      if (seenPermalinks.has(permalink) || !permalink.includes("/comments/")) {
        return;
      }

      seenPermalinks.add(permalink);
      candidates.push({ title, permalink });
    });
  };

  collect("shreddit-post");
  collect(".thing");
  collect("article");

  $("a[href*='/comments/']").each((_, element) => {
    const link = $(element);
    const permalink = link.attr("href");
    const title = trimText(link.text(), MAX_TITLE_LENGTH);

    if (!permalink || title.length < 12) {
      return;
    }

    const normalizedPermalink = normalizePermalink(permalink);
    if (seenPermalinks.has(normalizedPermalink)) {
      return;
    }

    seenPermalinks.add(normalizedPermalink);
    candidates.push({ title, permalink: normalizedPermalink });
  });

  return candidates.slice(0, MAX_POSTS);
}

function extractTopComments(html: string): string[] {
  const $ = cheerio.load(html);
  const comments: string[] = [];
  const seen = new Set<string>();
  const selectors = [
    "shreddit-comment",
    "[data-testid='comment']",
    "article[id^='t1_']",
    "div.Comment",
    ".comment",
  ];

  $(selectors.join(",")).each((_, element) => {
    const node = $(element);
    const richText = trimText(
      node
        .find("p, [slot='comment'], [data-testid='comment-body'], .md, .richtext, .entry .md")
        .map((__, child) => $(child).text())
        .get()
        .join(" "),
      MAX_COMMENT_LENGTH,
    );

    const fallbackText = trimText(node.text(), MAX_COMMENT_LENGTH);
    const comment = richText || fallbackText;

    if (
      !comment ||
      comment.length < 24 ||
      /^(deleted|removed)$/i.test(comment) ||
      seen.has(comment)
    ) {
      return;
    }

    seen.add(comment);
    comments.push(comment);
  });

  return comments.slice(0, MAX_COMMENTS);
}

async function fetchCommentsForPost(permalink: string): Promise<string[]> {
  try {
    const html = await scrapeUrl(toScrapeableRedditUrl(permalink));
    return extractTopComments(html);
  } catch {
    return [];
  }
}

async function mapInBatches<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((item, offset) => mapper(item, index + offset)),
    );

    results.push(...chunkResults);
  }

  return results;
}

export async function scrapeReddit(subreddit: string): Promise<string> {
  const normalizedSubreddit = subreddit.trim().replace(/^r\//i, "");
  const url = `https://old.reddit.com/r/${normalizedSubreddit}/top/?t=week`;

  return scrapeUrl(url);
}

export async function structureRedditData(subreddit: string): Promise<StructuredRedditData> {
  const subredditHtml = await scrapeReddit(subreddit);
  const candidates = extractPostCandidates(subredditHtml);

  if (candidates.length === 0) {
    throw new Error("No Reddit posts were extracted from the scraped HTML.");
  }

  const posts = await mapInBatches(candidates, COMMENT_FETCH_CONCURRENCY, async (candidate): Promise<RedditPost> => {
    const comments = await fetchCommentsForPost(candidate.permalink);

    return {
      title: candidate.title,
      comments,
      permalink: candidate.permalink,
      threadUrl: toAbsoluteRedditUrl(candidate.permalink),
    };
  });

  return {
    subreddit: subreddit.trim().replace(/^r\//i, ""),
    scrapedAt: new Date().toISOString(),
    posts: Array.from(new Map(
      posts
      .filter((post) => post.title)
      .sort((left, right) => right.comments.length - left.comments.length)
      .map((post) => [post.permalink, post]),
    ).values()).slice(0, MAX_POSTS),
  };
}