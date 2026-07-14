import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export async function POST(request) {
  try {
    const { logs } = await request.json();
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Get current logs
    const currentLogs = await redis.get('health_tracker_logs') || [];
    
    // Merge logs avoiding duplicates by ID
    const mergedMap = new Map();
    currentLogs.forEach(log => mergedMap.set(log.id, log));
    logs.forEach(log => {
      // Clean up local-only sync flag
      const { synced, ...pureLog } = log;
      mergedMap.set(log.id, pureLog);
    });

    const newLogsArray = Array.from(mergedMap.values());
    
    // Save back to Redis
    await redis.set('health_tracker_logs', newLogsArray);

    return NextResponse.json({ success: true, count: newLogsArray.length });
  } catch (error) {
    console.error('Redis POST Error:', error);
    return NextResponse.json({ error: 'Failed to sync logs' }, { status: 500 });
  }
}
