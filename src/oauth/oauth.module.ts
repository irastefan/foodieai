import { Module } from "@nestjs/common";
import { OauthController } from "./oauth.controller";
import { OauthDiscoveryController } from "./oauth.discovery.controller";
import { OauthService } from "./oauth.service";

@Module({
  controllers: [OauthController, OauthDiscoveryController],
  providers: [OauthService],
  exports: [OauthService],
})
export class OauthModule {}
