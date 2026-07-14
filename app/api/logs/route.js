import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Note: Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel Env Vars
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export async function GET() {
  try {
    // Basic setup: a single key 'health_tracker_logs' for this demo (usually tied to a userId)
    const logs = await redis.get('health_tracker_logs') || [];
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Redis GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
