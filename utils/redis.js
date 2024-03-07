import { promisify } from 'util';
import { createClient } from 'redis';

// this class to define methods for used redis commands
class RedisClient {
  constructor() {
    this.client = createClient();

    this.client.on('error', (error) => {
      console.log(`Redis client not connected to server: ${error}`);
    });
  }

  // func to check connection status and report
  isAlive() {
    if (this.client.connected) {
      return true;
    }
    return false;
  }

  // func to get value for given key from redis server
  async get(key) {
    const redGet = promisify(this.client.get).bind(this.client);

    const val = await redGet(key);
    return val;
  }

  // func to set key value pair to redis server
  async set(key, val, time) {
    const redSet = promisify(this.client.set).bind(this.client);

    await redSet(key, val);
    await this.client.expire(key, time);
  }

  // func to del key vale pair from redis server
  async del(key) {
    const redDel = promisify(this.client.del).bind(this.client);

    await redDel(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
