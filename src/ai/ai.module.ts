import { Module } from "@nestjs/common";
import { AiAccessModule } from "../ai-access/ai-access.module";
import { AuthModule } from "../auth/auth.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [AiAccessModule, AuthModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
