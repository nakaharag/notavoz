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
} from '@nestjs/common';
import { RecordsService, PatientRecord, CreateRecordInput } from '@services/records.service';
import { AuthGuard } from '../auth/auth.guard';


class UpdateRecordDto {
  patientName?: string;
  notes?: string;
}

@Controller('records')
@UseGuards(AuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  async findAll(): Promise<PatientRecord[]> {
    return this.recordsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<PatientRecord> {
    const record = await this.recordsService.findById(id);

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    return record;
  }

  @Post()
  async create(@Body() data: CreateRecordInput): Promise<PatientRecord> {
    return this.recordsService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRecordDto: UpdateRecordDto,
  ): Promise<PatientRecord> {
    const record = await this.recordsService.update(id, updateRecordDto);

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    return record;
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const deleted = await this.recordsService.delete(id);

    if (!deleted) {
      throw new NotFoundException('Registro nao encontrado');
    }

    return { success: true };
  }
}
