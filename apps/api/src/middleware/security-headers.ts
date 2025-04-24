import { createMiddleware } from 'hono/factory'

/**
 * Adds common HTTP security headers:
 *  • HSTS
 *  • CSP
 *  • X-Frame-Options
 *  • X-Content-Type-Options
 *  • Referrer-Policy
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  // 1. Enforce HTTPS for 2 years, include subdomains, and opt into preload list
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // 2. Content Security Policy — tighten this to your asset origins!
  c.header(
    'Content-Security-Policy',
    [
      // Optional: Provides a default fallback
      // "default-src 'self'",

      // Crucial for preventing framing of the API domain
      "frame-ancestors 'none'",

      // If the client consuming the API response needs to make further connections,
      // list the allowed origins here. 'self' covers the API origin.
      // Add your frontend origin(s) if the frontend makes other calls based on API data.
      `connect-src 'self' https://www.gefakit.com http://localhost:5173 https://your-frontend-domain.com`,

      // If you serve minimal static content like an index page or health check,
      // you might add relevant src directives:
      // "img-src 'self'",
      // "style-src 'self'", // Avoid 'unsafe-inline' if possible
      // "script-src 'self'", // Avoid 'unsafe-eval' or 'unsafe-inline' if possible

      // Less critical for pure data API responses, but harmless:
      // "base-uri 'self'",
      // "form-action 'self'",

    ].join('; ')
  )

  // 3. Prevent click-jacking
  c.header('X-Frame-Options', 'DENY')

  // 4. Stop MIME-sniffing
  c.header('X-Content-Type-Options', 'nosniff')

  // 5. Control referrer leakage
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  await next()
})
