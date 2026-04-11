import { ApiProperty } from "@nestjs/swagger";

export class UploadAiImageResponseDto {
  @ApiProperty({
    example: "ai-input-images/dev-user/2026/04/11/3d7f6ad1-9fd2-475f-9f68-f49dcc5e2c2d.jpg",
  })
  objectKey!: string;

  @ApiProperty({
    example: "https://storage.googleapis.com/your-bucket/ai-input-images/dev-user/2026/04/11/3d7f6ad1-9fd2-475f-9f68-f49dcc5e2c2d.jpg",
  })
  imageUrl!: string;

  @ApiProperty({
    example: "2026-04-11T19:45:00.000Z",
    description: "Expiration timestamp for signed URLs. Null for public URLs.",
    nullable: true,
  })
  expiresAt!: string | null;

  @ApiProperty({
    example: "image/jpeg",
  })
  contentType!: string;

  @ApiProperty({
    example: 245812,
  })
  size!: number;
}
