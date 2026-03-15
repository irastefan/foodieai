import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Cloud Run expects the HTTP server to bind quickly. Let Prisma connect lazily
    // on first query instead of blocking the process during boot.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
