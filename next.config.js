/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-s3-bucket.s3.amazonaws.com'], // Update with your S3 bucket
  },
};

module.exports = nextConfig;
