const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { logs } = req.body;
    
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      // Ha nincs beállítva, csak visszaadjuk, hogy oké, hogy a frontend befejezettnek tekintse a szinkronizálást
      console.warn("Redis credentials missing. Skipping sync.");
      return res.status(200).json({ success: true, message: 'Skipped (no redis config)' });
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    const pipeline = redis.pipeline();
    
    logs.forEach(log => {
      pipeline.hset(`log:${log.id}`, log);
    });

    await pipeline.exec();
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Redis Sync Error:', error);
    return res.status(500).json({ error: 'Failed to sync with Redis' });
  }
}
