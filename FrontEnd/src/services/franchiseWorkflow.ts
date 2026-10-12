export const franchiseStatusLabel = (status = 'pending'): string =>
  status === 'conditionally_approved'
    ? 'Approved'
    : status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FRANCHISE_APPLICATION_STAGES = [
  { status: 'program', label: 'Franchise opportunity' },
  { status: 'submitted', label: 'Application submission' },
  { status: 'under_review', label: 'Application review' },
  { status: 'location_assessment', label: 'Site assessment, final evaluation & franchise agreement' },
] as const;

export const franchiseStageIndex = ({ status }: { status: string }): number => {
  if (status === 'submitted' || status === 'pending') return 1;
  if (['under_review', 'additional_information_required', 'for_interview', 'on_hold'].includes(status)) return 2;
  if (status === 'active') return 4;
  if (['location_assessment', 'conditionally_approved', 'agreement_pending', 'requirements_pending', 'approved_for_opening', 'training'].includes(status)) return 3;
  return FRANCHISE_APPLICATION_STAGES.findIndex((stage) => stage.status === status);
};
