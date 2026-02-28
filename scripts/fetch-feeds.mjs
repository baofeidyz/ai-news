import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Parser from 'rss-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONCURRENCY = 10;
const TIMEOUT = 30000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY = 2000;
const DOMAIN_CONCURRENCY = 3;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
};

const parser = new Parser();

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Per-domain concurrency limiter
const domainSemaphores = new Map();

function getDomainSemaphore(domain) {
  if (!domainSemaphores.has(domain)) {
    domainSemaphores.set(domain, { running: 0, queue: [] });
  }
  return domainSemaphores.get(domain);
}

async function acquireDomain(domain) {
  const sem = getDomainSemaphore(domain);
  if (sem.running < DOMAIN_CONCURRENCY) {
    sem.running++;
    return;
  }
  await new Promise(resolve => sem.queue.push(resolve));
  sem.running++;
}

function releaseDomain(domain) {
  const sem = getDomainSemaphore(domain);
  sem.running--;
  if (sem.queue.length > 0) {
    const next = sem.queue.shift();
    next();
  }
}

async function fetchWithLimit(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchXml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`Status code ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeedWithRetry(source) {
  const domain = getDomain(source.url);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    await acquireDomain(domain);
    try {
      const xml = await fetchXml(source.url);
      const feed = await parser.parseString(xml);
      releaseDomain(domain);

      const items = (feed.items || []).slice(0, 20).map(item => ({
        title: item.title || '',
        link: item.link || '',
        description: (item.contentSnippet || item.content || '').slice(0, 500),
        pubDate: item.pubDate || item.isoDate || '',
        source: source.name,
      }));
      return { source: source.name, items, error: null };
    } catch (err) {
      releaseDomain(domain);

      const msg = err.name === 'AbortError' ? 'Request timed out' : err.message;

      const isRetryable = msg.includes('timed out') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('socket disconnected') ||
        msg.includes('Status code 429') ||
        msg.includes('Status code 503') ||
        msg.includes('fetch failed');

      if (!isRetryable || attempt === MAX_RETRIES) {
        const retryInfo = attempt > 0 ? ` (after ${attempt + 1} attempts)` : '';
        console.error(`  ✗ Failed: ${source.name}${retryInfo}: ${msg}`);
        return { source: source.name, items: [], error: msg };
      }
    }
  }
}

const TRANSLATE_CONCURRENCY = 10;
const TRANSLATE_TIMEOUT = 10000;

async function translateText(text, retries = 2) {
  if (!text || !text.trim()) return '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        if (attempt < retries) continue;
        return '';
      }
      if (!res.ok) return '';
      const data = await res.json();
      return data[0].map(s => s[0]).join('');
    } catch {
      clearTimeout(timer);
      if (attempt === retries) return '';
    }
  }
  return '';
}

async function translateAllItems(allItems) {
  const tasks = [];
  for (const item of allItems) {
    tasks.push(() => translateText(item.title).then(r => { item.titleZh = r; }));
    if (item.description) {
      tasks.push(() => translateText(item.description).then(r => { item.descriptionZh = r; }));
    } else {
      item.descriptionZh = '';
    }
  }

  const total = tasks.length;
  let completed = 0;

  const wrappedTasks = tasks.map(task => async () => {
    const result = await task();
    completed++;
    if (completed % 100 === 0 || completed === total) {
      console.log(`  翻译进度: ${completed}/${total}`);
    }
    return result;
  });

  console.log(`\n翻译 ${allItems.length} 条文章到中文 (${total} 个文本)...`);
  await fetchWithLimit(wrappedTasks, TRANSLATE_CONCURRENCY);
  console.log('翻译完成。');
}

async function main() {
  const sourcesPath = join(__dirname, '..', 'src', 'assets', 'sources.json');
  const outputDir = join(__dirname, '..', 'public', 'feed-data');
  const outputPath = join(outputDir, 'all-feeds.json');

  const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
  mkdirSync(outputDir, { recursive: true });

  const allFeeds = { categories: [], fetchedAt: new Date().toISOString() };
  let totalItems = 0;
  let totalErrors = 0;

  for (const category of sources.categories) {
    if (category.sources.length === 0) continue;
    console.log(`\nFetching category: ${category.name} (${category.sources.length} sources)`);

    domainSemaphores.clear();

    const tasks = category.sources.map(source => () => fetchFeedWithRetry(source));
    const results = await fetchWithLimit(tasks, CONCURRENCY);

    const categoryItems = [];
    for (const result of results) {
      if (result.error) {
        totalErrors++;
      } else {
        categoryItems.push(...result.items);
      }
    }

    categoryItems.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });

    allFeeds.categories.push({
      name: category.name,
      key: category.key,
      itemCount: categoryItems.length,
      items: categoryItems,
    });

    totalItems += categoryItems.length;
    console.log(`  ✓ ${category.name}: ${categoryItems.length} items`);
  }

  // 翻译所有文章的标题和描述到中文
  const allItems = allFeeds.categories.flatMap(c => c.items);
  await translateAllItems(allItems);

  writeFileSync(outputPath, JSON.stringify(allFeeds));
  console.log(`\nDone! Total: ${totalItems} items, ${totalErrors} errors`);
  console.log(`Output: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
