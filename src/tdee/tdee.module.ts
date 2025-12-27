import { Module } from "@nestjs/common";
import { TdeeService } from "./tdee.service";

@Module({
  providers: [TdeeService],
  exports: [TdeeService],
})
export class TdeeModule {}
