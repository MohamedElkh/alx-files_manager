import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  static getStatus(req, res) {
    res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static async getStats(req, res) {
    const usersx = await dbClient.nbUsers();
    const filesx = await dbClient.nbFiles();

    res.status(200).json({ users: usersx, files: filesx });
  }
}
