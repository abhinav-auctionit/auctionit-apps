import type { BusinessActivity, CompanyType, InterestedIn, SubscriptionType } from '@auction/types';

export const WIZARD_STEPS = [
  { id: 1, title: 'Personal' },
  { id: 2, title: 'Company' },
  { id: 3, title: 'Documents' },
  { id: 4, title: 'Terms' },
  { id: 5, title: 'Payment' },
] as const;

export type StepId = (typeof WIZARD_STEPS)[number]['id'];

export const COUNTRY_CODES: Array<{ code: string; label: string }> = [
  { code: '+91', label: '+91 India' },
  { code: '+971', label: '+971 UAE' },
];

export const INTERESTED_IN_OPTIONS: Array<{ value: InterestedIn; label: string }> = [
  { value: 'forward', label: 'Forward Auction' },
  { value: 'reverse', label: 'Reverse Auction' },
  { value: 'both', label: 'Both' },
];

export const COMPANY_TYPE_OPTIONS: Array<{ value: CompanyType; label: string }> = [
  { value: 'llp', label: 'LLP' },
  { value: 'llc', label: 'LLC' },
  { value: 'individual', label: 'Individual' },
  { value: 'limited', label: 'Limited' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'pvt_limited', label: 'Pvt Limited' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
];

export const BUSINESS_ACTIVITY_OPTIONS: Array<{ value: BusinessActivity; label: string }> = [
  { value: 'broker', label: 'Broker' },
  { value: 'end_user', label: 'End-User' },
  { value: 'trader', label: 'Trader' },
  { value: 'other', label: 'Any Other' },
];

export const SUBSCRIPTION_OPTIONS: Array<{ value: SubscriptionType; label: string; blurb: string }> = [
  { value: 'annual', label: 'Annual', blurb: 'Renews every 12 months' },
  { value: 'lifetime', label: 'Lifetime', blurb: 'One-time, no renewal' },
];

export const ACCEPT_FILE_TYPES =
  'image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
