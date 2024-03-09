import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  static getStatus(req, res) {
    res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static async getStats(req, res) {
    const urx = await dbClient.nbUsers();
    const frx = await dbClient.nbFiles();

    res.status(200).json({ users: urx, files: frx });
  }
}

module.exports = AppController;
