export const franchiseStatusLabel = (status = 'pending'): string => {
  if (status === 'conditionally_approved') return 'Final evaluation';
  if (status === 'for_final_evaluation') return 'Final evaluation';
  if (status === 'approved_for_opening') return 'Opening readiness';
  if (status === 'approved' || status === 'active') return 'Approved';
  if (status === 'additional_information_required') return 'Documents Requested';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const FRANCHISE_APPLICATION_STAGES = [
  { status: 'program', label: 'Franchise opportunity' },
  { status: 'submitted', label: 'Application submission' },
  { status: 'under_review', label: 'Application review' },
  { status: 'location_assessment', label: 'Site and final evaluation' },
  { status: 'approved', label: 'Final decision and dashboard access' },
] as const;

export const franchiseStageIndex = ({ status }: { status: string }): number => {
  if (status === 'submitted' || status === 'pending') return 1;
  if (['under_review', 'additional_information_required', 'for_interview', 'on_hold'].includes(status)) return 2;
  if (['approved', 'active', 'approved_for_opening'].includes(status)) return 4;
  if (['location_assessment', 'conditionally_approved', 'for_final_evaluation', 'agreement_pending', 'requirements_pending', 'training'].includes(status)) return 3;
  return FRANCHISE_APPLICATION_STAGES.findIndex((stage) => stage.status === status);
};
