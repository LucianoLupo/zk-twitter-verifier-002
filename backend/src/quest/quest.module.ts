import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { User } from '../database/entities/user.entity';
import { QuestCompletion } from '../database/entities/quest-completion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, QuestCompletion]),
    HttpModule,
  ],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
