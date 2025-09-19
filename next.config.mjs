/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only enable static export in production build, not during development
  // This allows API routes to work during local development
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export', // Enables static HTML export for production
  }),

  // For development, we need server-side rendering to support API routes
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
