import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const sessionGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.isReady()) {
    return router.createUrlTree(['/']);
  }
  await session.ensureContent();
  return true;
};
