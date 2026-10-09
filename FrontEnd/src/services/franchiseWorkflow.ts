export const franchiseStatusLabel = (status = 'pending'): string =>
  status === 'conditionally_approved'
    ? 'Approved'
    : status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FRANCHISE_APPLICATION_STAGES = [
  { status: 'program', label: 'Franchise opportunity' },
  { status: 'submitted', label: 'Application submission' },
  { status: 'under_review', label: 'Application review' },
  { status: 'agreement_pending', label: 'Agreement and requirements' },
  { status: 'approved_for_opening', label: 'Franchise activation' },
  { status: 'active', label: 'Franchise operations' },
] as const;

export const franchiseStageIndex = ({ status }: { status: string }): number => {
  if (status === 'submitted' || status === 'pending') return 1;
  if (['under_review', 'additional_information_required', 'for_interview', 'location_assessment', 'on_hold'].includes(status)) return 2;
  if (['conditionally_approved', 'agreement_pending', 'requirements_pending', 'training'].includes(status)) return 3;
  if (status === 'approved_for_opening') return 4;
  if (status === 'active') return 5;
  return FRANCHISE_APPLICATION_STAGES.findIndex((stage) => stage.status === status);
};
