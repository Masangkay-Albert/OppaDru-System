export const franchiseStatusLabel = (status = 'pending'): string => {
  const normalized = String(status || 'pending');
  if (normalized === 'under_review') return 'Under Review';
  if (normalized === 'for_interview') return 'For Interview';
  if (normalized === 'location_assessment') return 'Location Assessment';
  if (normalized === 'for_final_evaluation') return 'Final Evaluation';
  if (normalized === 'conditionally_approved') return 'Final Evaluation';
  if (normalized === 'approved_for_opening') return 'Approved';
  if (normalized === 'approved' || normalized === 'active') return 'Approved';
  if (normalized === 'additional_information_required') return 'Under Review';
  if (normalized === 'pending' || normalized === 'submitted') return 'Under Review';
  return normalized.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const FRANCHISE_APPLICATION_STAGES = [
  { status: 'under_review', label: 'Under Review' },
  { status: 'for_interview', label: 'For Interview' },
  { status: 'location_assessment', label: 'Location Assessment' },
  { status: 'for_final_evaluation', label: 'Final Evaluation' },
  { status: 'approved', label: 'Approved' },
] as const;

export const franchiseStageIndex = ({ status }: { status: string }): number => {
  const normalized = String(status || 'under_review');
  if (['submitted', 'pending', 'under_review', 'additional_information_required'].includes(normalized)) return 0;
  if (['for_interview', 'on_hold'].includes(normalized)) return 1;
  if (['location_assessment', 'requirements_pending', 'agreement_pending', 'training'].includes(normalized)) return 2;
  if (['for_final_evaluation', 'conditionally_approved'].includes(normalized)) return 3;
  if (['approved', 'active', 'approved_for_opening'].includes(normalized)) return 4;
  return FRANCHISE_APPLICATION_STAGES.findIndex((stage) => stage.status === normalized);
};
