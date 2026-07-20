import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    const MAX = 5;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt === MAX) throw err;
        const wait = attempt * 5000;
        console.warn(`[Prisma] DB connection attempt ${attempt} failed — retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
