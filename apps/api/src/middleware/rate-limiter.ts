/**
 * This is a middleware for rate limiting using a token bucket algorithm.
 * It is using Cloudflare KV to store the bucket state.
 * It is known that KV is not the best choice, but it is good enough for low-to-moderate traffic.
 * For high-traffic applications, a more scalable solution using Durable Objects would be more appropriate.
 */

import { Hono, MiddlewareHandler } from 'hono';
import { Context } from 'hono';

// Define the structure for storing bucket state in KV
interface TokenBucketState {
  tokens: number;
  lastRefillTimestamp: number; // Store timestamp in milliseconds
}

// Configuration options for the rate limiter
interface RateLimiterConfig {
  /** Cloudflare KV Namespace binding name (must exist in c.env) */
  kvBindingName: string;
  /** Maximum number of tokens the bucket can hold */
  maxTokens: number;
  /** Number of tokens to add per second */
  refillRatePerSecond: number;
  /** Cost of a single request (usually 1) */
  requestCost?: number;
  /**
   * Function to generate a unique key for rate limiting.
   * Defaults to using the connecting IP address.
   * Receives the Hono context.
   */
  keyGenerator?: (c: Context) => string | Promise<string>;
  /**
   * Time-to-live in seconds for KV entries after last access.
   * Helps automatically clean up inactive keys.
   * Should be long enough to cover refill period + inactivity tolerance.
   * Defaults to 1 hour (3600 seconds).
   */
  kvExpirationTtl?: number;
}

/**
 * Creates a Hono middleware for Token Bucket rate limiting using Cloudflare KV.
 *
 * @param config - Configuration options for the rate limiter.
 * @returns Hono MiddlewareHandler
 */
export function kvTokenBucketRateLimiter(config: RateLimiterConfig): MiddlewareHandler {
  const {
    kvBindingName,
    maxTokens,
    refillRatePerSecond,
    requestCost = 1, // Default cost is 1 token
    keyGenerator = defaultKeyGenerator,
    kvExpirationTtl = 3600, // Default TTL 1 hour
  } = config;

  // Input validation
  if (!kvBindingName) throw new Error('kvBindingName is required in config.');
  if (maxTokens <= 0) throw new Error('maxTokens must be positive.');
  if (refillRatePerSecond <= 0) throw new Error('refillRatePerSecond must be positive.');
   if (kvExpirationTtl <= 60) console.warn('kvExpirationTtl is recommended to be at least 60 seconds for KV.');


  // The actual middleware function
  return async (c, next) => {
    // Retrieve KV namespace from context using the binding name
    const kvNamespace = c.env[kvBindingName] as KVNamespace | undefined;

    if (!kvNamespace) {
        console.error(`Rate Limiter Error: KV Namespace binding "${kvBindingName}" not found in environment.`);
        c.status(500);
        return c.json({ error: 'Internal Server Error - Rate Limiter Misconfigured' }, 500);
    }

    const key = await keyGenerator(c);
    if (!key) {
      console.error('Rate limiter key could not be generated. Skipping limit.');
      await next();
      return;
    }

    const now = Date.now(); // Current time in milliseconds
    let bucketState: TokenBucketState | null = null;

    try {
      // 1. Read current state from KV
      bucketState = await kvNamespace.get<TokenBucketState>(key, { type: 'json' });

      let currentTokens: number;
      let lastRefill: number;

      if (bucketState === null) {
        // 2a. New key: Initialize bucket
        currentTokens = maxTokens;
        lastRefill = now;
      } else {
        // 2b. Existing key: Calculate refill
        const elapsedMillis = now - bucketState.lastRefillTimestamp;
        const tokensToAdd = Math.floor((elapsedMillis / 1000) * refillRatePerSecond);

        currentTokens = Math.min(
          bucketState.tokens + tokensToAdd,
          maxTokens // Cap at maxTokens
        );
        lastRefill = bucketState.lastRefillTimestamp + Math.floor(tokensToAdd / refillRatePerSecond) * 1000; // Advance lastRefill based on *whole* seconds refilled

        // Prevent lastRefill timestamp from drifting too far into the past if inactive
        if (now - lastRefill > (maxTokens / refillRatePerSecond) * 1000 * 1.1) { // Allow some buffer
            lastRefill = now; // Reset if significantly outdated
        }

      }

      // Log the current token count before checking
      console.log(`Bucket tokens left for key "${key}": ${currentTokens}`);

      // 3. Check if enough tokens are available
      if (currentTokens >= requestCost) {
        // 4a. Consume tokens and update state in KV
        const newState: TokenBucketState = {
          tokens: currentTokens - requestCost,
          lastRefillTimestamp: lastRefill, // Use potentially updated timestamp
        };
        // Use expirationTtl to auto-cleanup inactive keys
        await kvNamespace.put(key, JSON.stringify(newState), {
          expirationTtl: kvExpirationTtl,
        });

        // Set informative headers (optional)
        c.res.headers.set('X-RateLimit-Limit', String(maxTokens));
        c.res.headers.set('X-RateLimit-Remaining', String(newState.tokens));
        // Note: Calculating Reset time is complex with token bucket,
        // as it depends on when the *next* token refills.
        // We'll omit it for simplicity here.

        // Proceed to the next middleware/handler
        await next();
      } else {
        // 4b. Not enough tokens: Reject request
        c.status(429); // Too Many Requests
        c.res.headers.set('X-RateLimit-Limit', String(maxTokens));
        c.res.headers.set('X-RateLimit-Remaining', '0'); // No tokens left for this request

        // Calculate approximate time until *at least* `requestCost` tokens are available
        const tokensNeeded = requestCost - currentTokens;
        const secondsToWait = Math.ceil(tokensNeeded / refillRatePerSecond);
        c.res.headers.set('Retry-After', String(secondsToWait)); // Seconds until retry might succeed

        return c.json({ error: 'Too Many Requests' }, 429);
      }
    } catch (error) {
      // 5. Handle KV errors (fail closed - deny request)
      console.error(`KV Rate Limiter Error for key "${key}":`, error);
      c.status(500);
      // Optionally, you could choose to "fail open" by calling await next() here,
      // but failing closed is generally safer for protecting your origin.
      return c.json({ error: 'Internal Server Error - Rate Limiter Failed' }, 500);
    }
  };
}

// Default key generator using Cloudflare's connecting IP
function defaultKeyGenerator(c: Context): string {
  // 'cf-connecting-ip' is added by Cloudflare automatically
  const ip = c.req.header('cf-connecting-ip');
  if (!ip) {
      console.warn("Header 'cf-connecting-ip' not found. Falling back to generic key. Rate limiting might not be effective.");
      return "generic-key"; // Fallback, less effective
  }
  // Prefix to avoid potential collisions with other KV data
  return `rate-limit:${ip}`;
}


// --- Usage Example ---

// Assume 'RATE_LIMITER_KV' is bound in your wrangler.toml
interface Env {
  RATE_LIMITER_KV: KVNamespace;
  // Add other bindings if needed
}

const app = new Hono<{ Bindings: Env }>();

// Configure the middleware instance
const globalLimiter = kvTokenBucketRateLimiter({
  kvBindingName: 'RATE_LIMITER_KV', // Name of the binding in Env/wrangler.toml
  maxTokens: 100, // Allow 100 requests...
  refillRatePerSecond: 5, // ...refilling at 5 tokens per second
  // requestCost: 1, // Default is 1
  // keyGenerator: (c) => `user:${c.get('userId')}` // Example: Use user ID if available
  // kvExpirationTtl: 7200 // Example: 2 hours
});

// Apply the configured middleware instance directly
app.use('*', globalLimiter);


app.get('/', (c) => {
  return c.text('You reached the API!');
});

app.get('/expensive', (c) => {
    // Example: You could potentially have another limiter instance
    // with a higher cost or lower limits for specific routes.
    // (This simple example uses the global one)
    return c.text('This was an expensive operation!');
});

export default app;