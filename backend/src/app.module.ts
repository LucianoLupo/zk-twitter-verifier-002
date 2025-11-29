import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { VerificationModule } from './verification/verification.module';
import { QuestModule } from './quest/quest.module';
import { Verification } from './database/entities/verification.entity';
import { User } from './database/entities/user.entity';
import { QuestCompletion } from './database/entities/quest-completion.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/quests.db',
      entities: [Verification, User, QuestCompletion],
      synchronize: true, // Auto-create tables (disable in production)
    }),
    HttpModule,
    VerificationModule,
    QuestModule,
  ],
})
export class AppModule {}
