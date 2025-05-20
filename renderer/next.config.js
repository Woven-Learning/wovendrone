/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // This enables importing JSON files like package.json
    config.module.rules.push({
      test: /\.json$/,
      type: 'json'
    })
    return config
  },
}
