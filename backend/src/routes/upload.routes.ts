import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, authorize } from '../plugins/auth.js';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { env } from '../config/env.js';
import { randomUUID } from 'crypto';

const pump = util.promisify(pipeline);

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [authorize('TEACHER', 'ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ success: false, error: 'No file uploaded' });
    }

    const originalName = data.filename;
    // Generate a unique filename to prevent collisions
    const ext = path.extname(originalName);
    const uniqueFileName = `${randomUUID()}${ext}`;
    
    // Save to backend/uploads
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, uniqueFileName);
    
    await pump(data.file, fs.createWriteStream(filePath));
    
    // Return the URL that the frontend can use to download it
    // The static plugin will serve files from /api/v1/uploads prefix (we'll configure it in index.ts)
    const fileUrl = `/api/v1/uploads/${uniqueFileName}`;
    
    return {
      success: true,
      data: {
        fileUrl,
        fileName: originalName,
      }
    };
  });
}
