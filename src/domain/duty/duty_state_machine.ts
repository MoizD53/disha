import { DutyStatus } from "../../../generated/prisma/enums";

// Conceptual states mappings to Prisma Enum DutyStatus
export const DutyStates = {
  OFF_DUTY: null, // Represented by no active session
  DUTY_STARTED: DutyStatus.DUTY_STARTED,
  TRACKING_ACTIVE: DutyStatus.TRACKING_ACTIVE,
  SOS_ACTIVE: DutyStatus.SOS_ACTIVE,
  DUTY_ENDED: DutyStatus.DUTY_ENDED,
} as const;

export type DutyState = typeof DutyStates[keyof typeof DutyStates];

export function canStartDuty(currentState: DutyState): boolean {
  // Can only start duty if we are OFF_DUTY (no active session)
  return currentState === DutyStates.OFF_DUTY;
}

export function canEndDuty(currentState: DutyState): boolean {
  // Can end duty from STARTED, TRACKING, or SOS. Cannot end if already ENDED or OFF_DUTY.
  return (
    currentState === DutyStates.DUTY_STARTED ||
    currentState === DutyStates.TRACKING_ACTIVE ||
    currentState === DutyStates.SOS_ACTIVE
  );
}

export function canTransitionToTracking(currentState: DutyState): boolean {
  return currentState === DutyStates.DUTY_STARTED || currentState === DutyStates.SOS_ACTIVE;
}

export function canTransitionToSOS(currentState: DutyState): boolean {
  return currentState === DutyStates.DUTY_STARTED || currentState === DutyStates.TRACKING_ACTIVE;
}
