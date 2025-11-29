import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { QuestService } from './quest.service';
import { SubmitQuestDto } from './dto/submit-quest.dto';

@Controller('api/quest')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Get('progress/:walletAddress')
  async getProgress(@Param('walletAddress') walletAddress: string) {
    return this.questService.getUserProgress(walletAddress);
  }

  @Post(':questNumber/submit')
  @HttpCode(200)
  async submitQuest(
    @Param('questNumber') questNumber: string,
    @Body() body: Omit<SubmitQuestDto, 'questNumber'>,
  ) {
    const dto: SubmitQuestDto = {
      ...body,
      questNumber: parseInt(questNumber, 10),
    };
    return this.questService.submitQuest(dto);
  }
}
