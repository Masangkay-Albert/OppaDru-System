export const franchiseStatusLabel = (status = 'pending'): string =>
  status === 'conditionally_approved'
    ? 'Approved'
    : status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FRANCHISE_APPLICATION_STAGES = [
  { status: 'program', label: 'Franchise opportunity' },
  { status: 'submitted', label: 'Application submission' },
  { status: 'under_review', label: 'Application review and interview' },
  { status: 'location_assessment', label: 'Site inspection and assessment' },
  { status: 'conditionally_approved', label: 'Financial and final evaluation' },
  { status: 'agreement_pending', label: 'Franchise approval and agreement' },
] as const;

export const franchiseStageIndex = ({ status }: { status: string }): number => {
  if (status === 'submitted' || status === 'pending') return 1;
  if (['under_review', 'additional_information_required', 'for_interview', 'on_hold'].includes(status)) return 2;
  if (status === 'location_assessment') return 3;
  if (status === 'conditionally_approved') return 4;
  if (status === 'active') return 6;
  if (['agreement_pending', 'requirements_pending', 'approved_for_opening', 'training'].includes(status)) return 5;
  return FRANCHISE_APPLICATION_STAGES.findIndex((stage) => stage.status === status);
};
