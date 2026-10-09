export const franchiseStatusLabel = (status = 'pending'): string =>
  status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FRANCHISE_APPLICATION_STAGES = [
  { status: 'program', label: 'Franchisor publishes program' },
  { status: 'submitted', label: 'Application submitted' },
  { status: 'under_review', label: 'Review and due diligence' },
  { status: 'conditionally_approved', label: 'Approval decision' },
  { status: 'agreement_pending', label: 'Sign franchise agreement' },
  { status: 'requirements_pending', label: 'Payment and business setup' },
  { status: 'training', label: 'Training and system setup' },
  { status: 'approved_for_opening', label: 'Inspection and opening approval' },
  { status: 'active', label: 'Open and monitored' },
] as const;

export const franchiseStageIndex = (application: {
  status: string;
  franchise_fee_payment_status?: string;
  required_documents?: Array<{ required: boolean; status: string }>;
  location_readiness?: string;
  permit_compliance_status?: string;
  operational_preparation_status?: string;
}): number => {
  const { status } = application;
  if (status === 'submitted' || status === 'pending') return 1;
  if (['under_review', 'additional_information_required', 'for_interview', 'location_assessment', 'on_hold'].includes(status)) return 2;
  if (status === 'conditionally_approved') return 3;
  if (status === 'agreement_pending') return 4;
  if (status === 'requirements_pending') {
    const setupReady = ['paid', 'waived', 'not_applicable'].includes(application.franchise_fee_payment_status || '')
      && ['ready', 'not_applicable'].includes(application.location_readiness || '')
      && ['verified', 'not_applicable'].includes(application.permit_compliance_status || '')
      && ['complete', 'not_applicable'].includes(application.operational_preparation_status || '')
      && (application.required_documents || []).every((document) => !document.required || ['verified', 'not_applicable'].includes(document.status));
    return setupReady ? 6 : 5;
  }

  return FRANCHISE_APPLICATION_STAGES.findIndex((stage) => stage.status === status);
};
