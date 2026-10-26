import {
  ALLOWED_REQUEST_TRANSITIONS,
  REQUEST_STATE_LABELS,
  type RequestState,
  type UserRole,
} from '../../../shared/constants.ts';
import { AppError } from '../../middleware/error-handler.ts';

export function assertValidStateTransition(params: {
  from: RequestState;
  to: RequestState;
  actorRole: UserRole | 'system';
}): void {
  const allowedNext = ALLOWED_REQUEST_TRANSITIONS[params.from] ?? [];
  if (!allowedNext.includes(params.to)) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `انتقال وضعیت مأموریت از «${REQUEST_STATE_LABELS[params.from]}» به «${REQUEST_STATE_LABELS[params.to]}» مجاز نیست.`
    );
  }

  if (params.actorRole === 'customer') {
    const customerAllowedTargets: RequestState[] = ['Submitted', 'Cancelled'];
    if (!customerAllowedTargets.includes(params.to)) {
      throw new AppError(
        403,
        'CUSTOMER_TRANSITION_FORBIDDEN',
        'مشتری مجاز به اعمال این تغییر وضعیت عملیاتی نیست.'
      );
    }
  }

  if (params.actorRole === 'responder') {
    const responderAllowedTargets: RequestState[] = [
      'Accepted',
      'EnRoute',
      'Arrived',
      'InProgress',
      'Completed',
    ];
    if (!responderAllowedTargets.includes(params.to)) {
      throw new AppError(
        403,
        'RESPONDER_TRANSITION_FORBIDDEN',
        'امدادگر مجاز به اعمال این تغییر وضعیت نیست.'
      );
    }
  }
}
