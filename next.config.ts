import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "cms-assets.ldsvcplatform.com",
				pathname: "/IT/s3fs-public/**",
			},
		],
	},
};

export default nextConfig;
