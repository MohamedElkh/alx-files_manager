import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import mime from 'mime-types';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async getUser(req) {
    const token = req.header('X-Token');
    const keyx = `auth_${token}`;

    const userId = await redisClient.get(keyx);

    if (userId) {
      const users = dbClient.db.collection('users');
      const idObj = new ObjectID(userId);

      const user = await users.findOne({ _id: idObj });

      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(req, res) {
    const user = await FilesController.getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { name } = req.body;
    const { type } = req.body;

    const { parentId } = req.body;
    const isPublic = req.body.isPublic || false;

    const { data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const files = dbClient.db.collection('files');

    if (parentId) {
      const idObj = new ObjectID(parentId);
      const file = await files.findOne({ _id: idObj, userId: user._id });

      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      files.insertOne(
        {
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
        },
      ).then((result) => res.status(201).json({
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic,
        parentId: parentId || 0,
      })).catch((error) => {
        console.log(error);
      });
    } else {
      const filePth = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileN = `${filePth}/${uuidv4()}`;

      const buffx = Buffer.from(data, 'base64');
      // const storeThis = buff.toString('utf-8');
      try {
        try {
          await fs.mkdir(filePth);
        } catch (error) {
        // pass. Error raised when file already exists
        }
        await fs.writeFile(fileN, buffx, 'utf-8');
      } catch (error) {
        console.log(error);
      }
      files.insertOne(
        {
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileN,
        },
      ).then((result) => {
        res.status(201).json(
          {
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          },
        );
        if (type === 'image') {
          fileQueue.add(
            {
              userId: user._id,
              fileId: result.insertedId,
            },
          );
        }
      }).catch((error) => console.log(error));
    }
    return null;
  }

  static async getShow(req, res) {
    const user = await FilesController.getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const files = dbClient.db.collection('files');

    const idObj = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObj, userId: user._id });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const user = await FilesController.getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      parentId,
      page,
    } = req.query;

    const pageN = page || 0;
    const files = dbClient.db.collection('files');

    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageN, 10) } }],
            data: [{ $skip: 20 * parseInt(pageN, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;

          return tmpFile;
        });
        // console.log(final);
        return res.status(200).json(final);
      }
      console.log('Error occured');
      return res.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  static async putPublish(req, res) {
    const user = await FilesController.getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const files = dbClient.db.collection('files');

    const idObj = new ObjectID(id);
    const newVal = { $set: { isPublic: true } };

    const options = { returnOriginal: false };
    files.findOneAndUpdate({ _id: idObj, userId: user._id }, newVal, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(200).json(file.value);
    });
    return null;
  }

  static async putUnpublish(req, res) {
    const user = await FilesController.getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const files = dbClient.db.collection('files');

    const idObj = new ObjectID(id);
    const newVal = { $set: { isPublic: false } };

    const options = { returnOriginal: false };

    files.findOneAndUpdate({ _id: idObj, userId: user._id }, newVal, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(200).json(file.value);
    });
    return null;
  }

  static async getFile(req, res) {
    const { id } = req.params;

    const files = dbClient.db.collection('files');
    const idObj = new ObjectID(id);

    files.findOne({ _id: idObj }, async (err, file) => {
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      console.log(file.localPath);

      if (file.isPublic) {
        if (file.type === 'folder') {
          return res.status(400).json({ error: "A folder doesn't have content" });
        }
        try {
          let fileN = file.localPath;
          const size = req.param('size');

          if (size) {
            fileN = `${file.localPath}_${size}`;
          }

          const data = await fs.readFile(fileN);
          const contentType = mime.contentType(file.name);

          return res.header('Content-Type', contentType).status(200).send(data);
        } catch (error) {
          console.log(error);
          return res.status(404).json({ error: 'Not found' });
        }
      } else {
        const user = await FilesController.getUser(req);

        if (!user) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === 'folder') {
            return res.status(400).json({ error: "A folder doesn't have content" });
          }
          try {
            let fileN = file.localPath;
            const size = req.param('size');

            if (size) {
              fileN = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);

            return res.header('Content-Type', contentType).status(200).sendFile(fileN);
          } catch (error) {
            console.log(error);
            return res.status(404).json({ error: 'Not found' });
          }
        } else {
          console.log(`Wrong user: file.userId=${file.userId}; userId=${user._id}`);
          return res.status(404).json({ error: 'Not found' });
        }
      }
    });
  }
}

module.exports = FilesController;
