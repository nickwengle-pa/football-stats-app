/**
 * Cloudflare Publish Service
 * Publishes static HTML stats pages to Cloudflare Pages via Worker proxy
 */

import { SeasonStatsExport } from './seasonStatsService';
import { generatePublicSiteHtml } from './publicSiteGenerator';

// Worker proxy URL - handles CORS and forwards to Cloudflare API
const PUBLISH_WORKER_URL = 'https://pl-stats-publisher.nick-w-engle.workers.dev';

// Cloudflare API configuration from environment variables
export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  projectName: string;
}

export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
  deploymentId?: string;
}

/**
 * Get the Cloudflare config from environment variables
 */
export const getCloudflareConfig = (): CloudflareConfig | null => {
  const accountId = process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.REACT_APP_CLOUDFLARE_API_TOKEN;
  const projectName = process.env.REACT_APP_CLOUDFLARE_PROJECT_NAME;
  
  if (!accountId || !apiToken || !projectName) {
    console.warn('Cloudflare config not found in environment variables');
    return null;
  }
  
  return { accountId, apiToken, projectName };
};

/**
 * Check if Cloudflare publishing is configured
 */
export const isCloudflareConfigured = (): boolean => {
  return getCloudflareConfig() !== null;
};

/**
 * Generate a unique subdomain-safe slug for the team/season
 */
const generateSlug = (teamName: string, year: number, seasonLabel: string): string => {
  const base = `${teamName}-${year}-${seasonLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base.substring(0, 50); // Keep it reasonable length
};

/**
 * Publish stats page to Cloudflare Pages using Direct Upload
 * 
 * This uses the Cloudflare Pages Direct Upload API to deploy a single HTML file.
 * The deployment will be available at: https://<deployment-id>.<project-name>.pages.dev
 */
export const publishToCloudflare = async (
  data: SeasonStatsExport
): Promise<PublishResult> => {
  const config = getCloudflareConfig();
  
  if (!config) {
    return {
      success: false,
      error: 'Cloudflare not configured. Set REACT_APP_CLOUDFLARE_* environment variables.',
    };
  }
  
  try {
    const html = generatePublicSiteHtml(data);
    
    // Use the Worker proxy to avoid CORS issues
    const response = await fetch(PUBLISH_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        apiToken: config.apiToken,
        accountId: config.accountId,
        projectName: config.projectName,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.errors?.[0]?.message || result.error || `Failed to deploy: ${response.statusText}`,
      };
    }

    const deployment = result.result;

    return {
      success: true,
      url: deployment.url || `https://${deployment.id}.${config.projectName}.pages.dev`,
      deploymentId: deployment.id,
    };
  } catch (error) {
    console.error('Cloudflare publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Alternative: Publish using Cloudflare Workers KV
 * This stores the HTML in KV and serves it via a Worker
 */
export interface KVPublishConfig {
  accountId: string;
  apiToken: string;
  namespaceId: string;  // KV namespace ID
  workerUrl: string;    // Base URL of the worker that serves KV content
}

export const publishToKV = async (
  data: SeasonStatsExport,
  config: KVPublishConfig
): Promise<PublishResult> => {
  try {
    const html = generatePublicSiteHtml(data);
    const slug = generateSlug(data.teamName, data.season.year, data.season.label);
    const key = `stats/${slug}`;
    
    // Write to KV
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'text/html',
        },
        body: html,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || `Failed to publish: ${response.statusText}`,
      };
    }

    return {
      success: true,
      url: `${config.workerUrl}/${slug}`,
    };
  } catch (error) {
    console.error('KV publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Alternative: Upload to Cloudflare R2 with public access
 */
export interface R2PublishConfig {
  accountId: string;
  apiToken: string;
  bucketName: string;
  publicUrl: string;  // The public URL for the R2 bucket (if using custom domain or r2.dev)
}

export const publishToR2 = async (
  data: SeasonStatsExport,
  config: R2PublishConfig
): Promise<PublishResult> => {
  try {
    const html = generatePublicSiteHtml(data);
    const slug = generateSlug(data.teamName, data.season.year, data.season.label);
    const key = `${slug}/index.html`;
    
    // Upload to R2
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'text/html',
        },
        body: html,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || `Failed to upload: ${response.statusText}`,
      };
    }

    return {
      success: true,
      url: `${config.publicUrl}/${slug}/`,
    };
  } catch (error) {
    console.error('R2 publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export { };
