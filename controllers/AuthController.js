import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const authDx = req.header('Authorization');
    let userEmail = authDx.split(' ')[1];

    const buffx = Buffer.from(userEmail, 'base64');
    userEmail = buffx.toString('ascii');

    const data = userEmail.split(':'); // contains email and password
    if (data.length !== 2) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const hashedPassword = sha1(data[1]);

    const users = dbClient.db.collection('users');

    users.findOne({ email: data[0], password: hashedPassword }, async (err, user) => {
      if (user) {
        const tokenx = uuidv4();
        const key = `auth_${tokenx}`;

        await redisClient.set(key, user._id.toString(), 60 * 60 * 24);

        res.status(200).json({ tokenx });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });
  }

  static async getDisconnect(req, res) {
    const tokenx = req.header('X-Token');
    const key = `auth_${tokenx}`;
    const id = await redisClient.get(key);

    if (id) {
      await redisClient.del(key);
      res.status(204).json({});
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = AuthController;
