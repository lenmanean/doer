/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Ignore ESLint errors during builds (for deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Suppress webpack warnings
  webpack: (config, { dev, isServer }) => {
    config.ignoreWarnings = [
      // Ignore Supabase realtime warnings about Node.js APIs in Edge Runtime
      // These are expected and don't affect functionality
      { module: /node_modules\/@supabase\/realtime-js/ },
      { module: /node_modules\/@supabase\/supabase-js/ },
      // Ignore webpack cache performance warnings
      { message: /Serializing big strings/ },
    ]
    
    // Optimize webpack cache for large strings
    if (!dev) {
      config.infrastructureLogging = {
        level: 'error',
      }
    }
    
    return config
  },
};

export default nextConfig;
  