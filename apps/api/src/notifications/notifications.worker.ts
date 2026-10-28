import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AbandonedCartService } from './abandoned-cart.service';
import { NotificationsService } from './notifications.service';

const TICK_MS = 15_000;

/** Lightweight in-process poller for outbox drain + abandoned-cart claims. */
@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly abandonedCart: AbandonedCartService,
  ) {}

  onModuleInit() {
    if (process.env.NOTIFICATIONS_WORKER === '0') {
      this.logger.log('Notifications worker disabled (NOTIFICATIONS_WORKER=0)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    // Kick once shortly after boot
    setTimeout(() => void this.tick(), 2_000);
    this.logger.log(`Notifications worker started (every ${TICK_MS}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const abandoned = await this.abandonedCart.processDueCarts();
      const sent = await this.notifications.processOutbox();
      if (abandoned > 0 || sent > 0) {
        this.logger.log(
          `tick: abandonedQueued=${abandoned} emailsSent=${sent}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `tick failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }
}
