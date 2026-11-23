import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RecordsService, PatientRecord } from '../services/records.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { IsString, IsOptional, MaxLength } from 'class-validator';

class CreateRecordDto {
  @IsString()
  @MaxLength(30000)
  @IsOptional()
  patientName?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  rawTranscript?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  correctedTranscript?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  summary?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  notes?: string;
}

class UpdateRecordDto {
  @IsString()
  @MaxLength(30000)
  @IsOptional()
  correctedTranscript?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  summary?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  patientName?: string;

  @IsString()
  @MaxLength(30000)
  @IsOptional()
  notes?: string;
}

@Controller('records')
@UseGuards(AuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<PatientRecord[]> {
    return this.recordsService.findAll(user.id);
  }

  @Get(':id')
  async findById(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PatientRecord> {
    const record = await this.recordsService.findById(user.id, id);

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    return record;
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() data: CreateRecordDto): Promise<PatientRecord> {
    return this.recordsService.create(user.id, data);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateRecordDto: UpdateRecordDto,
  ): Promise<PatientRecord> {
    const record = await this.recordsService.update(user.id, id, updateRecordDto);

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    return record;
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<{ success: boolean }> {
    const deleted = await this.recordsService.delete(user.id, id);

    if (!deleted) {
      throw new NotFoundException('Registro nao encontrado');
    }

    return { success: true };
  }
}
