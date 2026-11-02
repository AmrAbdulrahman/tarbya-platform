import { ApiProperty } from '@nestjs/swagger';

export class ManagementNodeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) managerId!:
    string | null;
}
