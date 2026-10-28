import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminDomainsController } from './admin-domains.controller';
import { DomainsService } from './domains.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminDomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
