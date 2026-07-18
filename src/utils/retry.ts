import { log } from "./logger";

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  label?: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` with exponential backoff + jitter.
 * Delays: base, base*2, base*4 ... plus up to 30% random jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === opts.retries) break;
      const backoff = opts.baseDelayMs * Math.pow(2, attempt);
      const jitter = backoff * 0.3 * Math.random();
      const delay = Math.round(backoff + jitter);
      log(
        `Retry ${attempt + 1}/${opts.retries}${
          opts.label ? ` for ${opts.label}` : ""
        } in ${Math.round(delay / 1000)}s...`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}
