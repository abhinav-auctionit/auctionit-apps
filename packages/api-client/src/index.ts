import type {
  AttributeType,
  BidderCountry,
  BidderMarkFeePaidInput,
  BidderProfilePatchInput,
  BidderRegisterInput,
  BidderRejectInput,
  BidderStatus,
  BusinessActivity,
  CompanyType,
  CreateAttributeInput,
  CreateCategoryInput,
  CreateItemInput,
  CreateSubcategoryInput,
  CreateUserInput,
  InterestedIn,
  ItemAttributeValueInput,
  LoginInput,
  OtpSendEmailInput,
  OtpSendMobileInput,
  OtpVerifyEmailInput,
  OtpVerifyMobileInput,
  RegisterInput,
  SubscriptionType,
  Uom,
  UpdateAttributeInput,
  UpdateItemInput,
  User,
  WalletCreditInput,
  WalletDebitInput,
  WalletTxnKind,
  ClientCountry,
  ClientCreateInput,
  ClientUpdateInput,
  ClientLocationCreateInput,
  ClientLocationUpdateInput,
  ClientContactCreateInput,
  ClientContactUpdateInput,
  ClientEngagementCreateInput,
  ClientEngagementUpdateInput,
  EngagementMedium,
  EngagementPurpose,
  InternalContactRole,
  InternalContactsUpdateInput,
  OtherChargeType,
  StaggeringOfLots,
  AuctionStatus,
  AuctionType,
  AttachToLotsInput,
  AttachToConsolidatedInput,
  CreateAuctionInput,
  CreateLotInput,
  LotOutcomeNoteInput,
  LotOutcomeStatus,
  LotState,
  PlaceBidInput,
  PlaceBidResult,
  UpdateAuctionInput,
  UpdateLotInput,
} from '@auction/types';

export type { LotState, PlaceBidInput, PlaceBidResult } from '@auction/types';

export type ApiClientOptions = {
  baseUrl: string;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      res.statusText ||
      'Request failed';
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

export type CategoryWithSubcategories = {
  id: string;
  name: string;
  position: number;
  itemCount: number;
  subcategories: { id: string; name: string; position: number; itemCount: number }[];
};

export type AttributeOption = { id: string; attributeId: string; value: string; position: number };

export type AttributeListItem = {
  id: string;
  name: string;
  type: AttributeType;
  unit: string | null;
  description: string | null;
  position: number;
  usedIn: number;
  options: AttributeOption[];
};

export type ItemAttributeValueRead = {
  id: string;
  attributeId: string | null;
  customName: string | null;
  valueText: string | null;
  valueNumber: string | null;
  valueOptionIds: string[] | null;
  attrName: string | null;
  attrType: AttributeType | null;
  attrUnit: string | null;
};

export type ItemListRow = {
  id: string;
  name: string;
  uom: Uom;
  hsnCode: string;
  benchmarkCents: number | null;
  subcategoryId: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  attributeValues: ItemAttributeValueRead[];
};

export type ItemDetail = ItemListRow & {
  createdAt: string;
  updatedAt: string;
};

export type SuggestedAttributesResponse = {
  total: number;
  attributes: { id: string; name: string; type: AttributeType; unit: string | null; used: number }[];
};

export type StoredFile = {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string | null;
  createdAt: string;
};

export type CountriesResponse = Record<BidderCountry, string[]>;

export type BidderProfile = {
  id: string;
  userId: string;
  interestedIn: InterestedIn | null;
  fullName: string | null;
  contactCountryCode: string | null;
  contactNumber: string | null;
  whatsappCountryCode: string | null;
  whatsappNumber: string | null;
  companyName: string | null;
  companyType: CompanyType | null;
  businessActivity: BusinessActivity | null;
  address: string | null;
  country: BidderCountry | null;
  state: string | null;
  city: string | null;
  pinCode: string | null;
  designation: string | null;
  secondaryNumber: string | null;
  registeredEmail: string | null;
  gst: string | null;
  pan: string | null;
  panCardFileId: string | null;
  proofOfAddressFileId: string | null;
  cancelledChequeFileId: string | null;
  otherFileId: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  termsAcceptedAt: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
  signatoryPlace: string | null;
  signatoryDate: string | null;
  subscriptionType: SubscriptionType | null;
  registrationFeePaid: boolean;
  registrationFeePaidAt: string | null;
  registrationFeeNote: string | null;
  status: BidderStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BidderProfileWithUser = BidderProfile & {
  user: { id: string; email: string; name: string };
};

export type BidderProfileDetail = BidderProfile & {
  user: {
    id: string;
    email: string;
    name: string;
    mobileCountryCode: string | null;
    mobileNumber: string | null;
    role: 'admin' | 'client' | 'bidder';
    createdAt: string;
  };
  panCardFile: StoredFile | null;
  proofOfAddressFile: StoredFile | null;
  cancelledChequeFile: StoredFile | null;
  otherFile: StoredFile | null;
};

export type Wallet = {
  id: string;
  bidderProfileId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type WalletTransaction = {
  id: string;
  walletId: string;
  kind: WalletTxnKind;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdById: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string } | null;
};

export type BidderWalletRow = {
  profileId: string;
  fullName: string;
  companyName: string | null;
  contactCountryCode: string;
  contactNumber: string;
  user: { id: string; name: string; email: string };
  balance: number;
  lockedBalance: number;
  walletUpdatedAt: string | null;
};

export type Client = {
  id: string;
  companyName: string;
  phone: string | null;
  websiteUrl: string | null;
  registeredAddress: string;
  country: ClientCountry;
  pan: string;
  tan: string;
  tin: string;
  isActive: boolean;
  prefixAuctionCode: string | null;
  suffixAuctionCode: string | null;
  autoExtend: boolean;
  extendIfLastBidSec: number | null;
  extendDurationSec: number | null;
  extensionMaxTimes: number | null;
  staggeringOfLots: StaggeringOfLots | null;
  staggeringOfLotsDurationSec: number | null;
  staggeringOfAuction: boolean | null;
  staggeringOfAuctionDurationSec: number | null;
  otherChargeType: OtherChargeType | null;
  otherChargeAmount: number | null;
  revenueRate: number;
  plantTechPersonDetails: string | null;
  displayMaterialLocation: boolean;
  displayPlantLocation: boolean;
  allowsConsolidatedEmd: boolean;
  tncFileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientWithTnc = Client & { tncFile: StoredFile | null };

export type ClientContactPoint = {
  id: string;
  locationId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientLocation = {
  id: string;
  clientId: string;
  name: string;
  addressLine: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientLocationWithContacts = ClientLocation & {
  contacts: ClientContactPoint[];
};

export type ClientEngagement = {
  id: string;
  clientId: string;
  happenedAt: string;
  personName: string;
  personRole: string | null;
  purpose: EngagementPurpose;
  medium: EngagementMedium;
  comments: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientEngagementWithUser = ClientEngagement & {
  createdBy: { id: string; name: string; email: string } | null;
};

export type Auction = {
  id: string;
  clientId: string;
  locationId: string | null;
  code: string;
  name: string;
  auctionType: AuctionType;
  status: AuctionStatus;
  consolidatedEmdAmount: number | null;
  description: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuctionLocationSummary = {
  id: string;
  name: string;
  city: string;
  state: string;
};

export type AuctionListRow = Auction & {
  client: { id: string; companyName: string; country: string };
  location: AuctionLocationSummary | null;
  _count: { lots: number };
};

export type LotItemRef = {
  id: string;
  name: string;
  uom: Uom;
  subcategory: {
    id: string;
    name: string;
    category: { id: string; name: string };
  };
};

export type Lot = {
  id: string;
  auctionId: string;
  lotNo: number;
  itemId: string | null;
  itemName: string;
  description: string | null;
  qty: string;
  uom: Uom;
  auctionDate: string;
  startTime: string;
  endTime: string;
  startingPriceCents: number;
  bidIncrementCents: number;
  emdAmount: number;
  winnerId: string | null;
  winningBidAmountCents: number | null;
  outcomeStatus: LotOutcomeStatus | null;
  liftedAt: string | null;
  forfeitedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  item: LotItemRef | null;
  winner: {
    id: string;
    name: string;
    email: string;
    bidderProfile: { companyName: string | null } | null;
  } | null;
};

export type AuctionDetail = Auction & {
  client: { id: string; companyName: string; country: string };
  location: AuctionLocationSummary | null;
  createdBy: { id: string; name: string; email: string } | null;
  lots: Lot[];
};

export type BidderSearchResult = {
  id: string;
  fullName: string;
  companyName: string | null;
  contactCountryCode: string;
  contactNumber: string;
  user: { id: string; name: string; email: string };
  wallet: { balance: number; lockedBalance: number } | null;
};

export type ParticipantLotRow = {
  lotId: string;
  lotNo: number;
  itemName: string;
  lotEmdAmount: number;
  emdHeldAmount: number;
  hasBid: boolean;
  attachedAt: string;
  releasedAt: string | null;
};

export type ParticipantBidder = {
  bidderProfileId: string;
  profile: {
    id: string;
    fullName: string;
    companyName: string | null;
    contactCountryCode: string;
    contactNumber: string;
    user: { id: string; name: string; email: string };
  };
  mode: 'lot' | 'consolidated';
  totalEmdHeld: number;
  consolidatedSettledAt: string | null;
  lots: ParticipantLotRow[];
  auctionParticipationId: string | null;
};

export type ParticipantsView = {
  // Whether this auction offers consolidated EMD as an option for bidders.
  // True when Auction.consolidatedEmdAmount is non-null (which itself requires
  // the client to allow consolidated EMD).
  consolidatedAvailable: boolean;
  consolidatedAmount: number | null;
  bidders: ParticipantBidder[];
};

export type AttachFailure = {
  bidderProfileId: string;
  reason: 'not_found' | 'not_approved' | 'insufficient_balance';
  message: string;
};

export type AttachResult = {
  created: number;
  skippedExisting: number;
  failures: AttachFailure[];
};

export type BidderAuctionSummary = {
  id: string;
  code: string;
  name: string;
  auctionType: AuctionType;
  status: AuctionStatus;
  consolidatedEmdAmount: number | null;
  client: { id: string; companyName: string };
  mode: 'lot' | 'consolidated';
  lotCount: number;
  totalEmdHeld: number;
  earliestStartTime: string | null;
  latestEndTime: string | null;
  consolidatedSettledAt: string | null;
};

export type BidderAuctionLot = {
  lotId: string;
  lotNo: number;
  itemName: string;
  description: string | null;
  qty: string;
  uom: Uom;
  startTime: string;
  endTime: string;
  startingPriceCents: number;
  bidIncrementCents: number;
  lotEmdAmount: number;
  emdHeldAmount: number;
  attachedAt: string;
  releasedAt: string | null;
  outcomeStatus: LotOutcomeStatus | null;
  isWinner: boolean;
  winningBidAmountCents: number | null;
};

export type BidderAuctionDetail = {
  auction: {
    id: string;
    code: string;
    name: string;
    auctionType: AuctionType;
    status: AuctionStatus;
    consolidatedEmdAmount: number | null;
    description: string | null;
    client: { id: string; companyName: string };
    location: { id: string; name: string; city: string; state: string } | null;
  };
  mode: 'lot' | 'consolidated';
  consolidated: {
    heldAmount: number;
    settledAt: string | null;
    settlementRefundAmount: number | null;
    settlementForfeitAmount: number | null;
    settlementShortfallAmount: number;
  } | null;
  lots: BidderAuctionLot[];
};

export type AuctionHistoryRow = {
  id: string;
  code: string;
  name: string;
  status: AuctionStatus;
  startAt: string | null;
  location: AuctionLocationSummary | null;
  totalQty: number;
  qtyUom: string | null;
  totalAmountCents: number;
};

export type AuctionHistoryStats = {
  totalAuctions: number;
  totalValueCents: number;
  avgValueCents: number;
  totalQty: number;
  qtyUom: string | null;
};

export type AuctionHistoryUpcoming = AuctionHistoryRow & {
  firstItemName: string | null;
};

export type AuctionHistoryResponse = {
  stats: AuctionHistoryStats;
  upcoming: AuctionHistoryUpcoming | null;
  auctions: AuctionHistoryRow[];
  locations: AuctionLocationSummary[];
};

export type AdminStaffMember = {
  id: string;
  name: string;
  email: string;
  mobileCountryCode: string | null;
  mobileNumber: string | null;
  createdAt: string;
};

export type InternalContactUserInfo = {
  id: string;
  name: string;
  email: string;
  mobileCountryCode: string | null;
  mobileNumber: string | null;
};

export type ClientInternalContactAssignment = {
  id: string;
  role: InternalContactRole;
  assignedAt: string;
  user: InternalContactUserInfo;
  kamClientCount: number | null;
};

export function createApiClient({ baseUrl }: ApiClientOptions) {
  const json = (method: string, body?: unknown) => ({
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return {
    auth: {
      login: (body: LoginInput) =>
        request<User>(baseUrl, '/auth/login', json('POST', body)),
      register: (body: RegisterInput) =>
        request<User>(baseUrl, '/auth/register', json('POST', body)),
      logout: () => request<{ ok: true }>(baseUrl, '/auth/logout', { method: 'POST' }),
      me: () => request<User>(baseUrl, '/auth/me'),
      createUser: (body: CreateUserInput) =>
        request<User>(baseUrl, '/auth/users', json('POST', body)),

      loginEmailOtpSend: (body: OtpSendEmailInput) =>
        request<void>(baseUrl, '/auth/login/email-otp/send', json('POST', body)),
      loginEmailOtpVerify: (body: OtpVerifyEmailInput) =>
        request<User>(baseUrl, '/auth/login/email-otp/verify', json('POST', body)),

      loginMobileOtpSend: (body: OtpSendMobileInput) =>
        request<void>(baseUrl, '/auth/login/mobile-otp/send', json('POST', body)),
      loginMobileOtpVerify: (body: OtpVerifyMobileInput) =>
        request<User>(baseUrl, '/auth/login/mobile-otp/verify', json('POST', body)),

      bidderOtpSend: (body: OtpSendMobileInput) =>
        request<void>(baseUrl, '/auth/bidder/otp/send', json('POST', body)),
      bidderOtpVerify: (body: OtpVerifyMobileInput) =>
        request<{ verificationToken: string }>(
          baseUrl,
          '/auth/bidder/otp/verify',
          json('POST', body),
        ),
      bidderRegister: (body: BidderRegisterInput) =>
        request<User>(baseUrl, '/auth/bidder/register', json('POST', body)),
    },
    bidder: {
      countries: () => request<CountriesResponse>(baseUrl, '/bidder/countries'),
      getMyProfile: () => request<BidderProfile>(baseUrl, '/bidder/me/profile'),
      patchMyProfile: (body: BidderProfilePatchInput) =>
        request<BidderProfile>(baseUrl, '/bidder/me/profile', json('PATCH', body)),
      submitMyProfile: () =>
        request<BidderProfile>(baseUrl, '/bidder/me/profile/submit', { method: 'POST' }),
      getMyWallet: () => request<Wallet>(baseUrl, '/bidder/me/wallet'),
      listMyWalletTxns: (params: { limit?: number; before?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.before) qs.set('before', params.before);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<WalletTransaction[]>(baseUrl, `/bidder/me/wallet/transactions${suffix}`);
      },
      listMyAuctions: () =>
        request<BidderAuctionSummary[]>(baseUrl, '/bidder/me/auctions'),
      getMyAuction: (auctionId: string) =>
        request<BidderAuctionDetail>(baseUrl, `/bidder/me/auctions/${auctionId}`),
      placeBid: (auctionId: string, lotId: string, body: PlaceBidInput) =>
        request<PlaceBidResult>(
          baseUrl,
          `/bidder/auctions/${auctionId}/lots/${lotId}/bids`,
          json('POST', body),
        ),
      getLotState: (auctionId: string, lotId: string) =>
        request<LotState>(
          baseUrl,
          `/bidder/auctions/${auctionId}/lots/${lotId}/state`,
        ),
    },
    files: {
      upload: async (file: File): Promise<StoredFile> => {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${baseUrl}/api/files`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok) {
          const message =
            (payload && typeof payload === 'object' && 'message' in payload
              ? String(payload.message)
              : null) ||
            res.statusText ||
            'upload failed';
          throw new ApiError(res.status, message, payload);
        }
        return payload as StoredFile;
      },
      get: (id: string) => request<StoredFile>(baseUrl, `/files/${id}`),
      contentUrl: (id: string) => `${baseUrl}/api/files/${id}/content`,
    },
    adminBidders: {
      list: (params: { status?: BidderStatus } = {}) => {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<BidderProfileWithUser[]>(baseUrl, `/admin/bidder-profiles${suffix}`);
      },
      get: (id: string) =>
        request<BidderProfileDetail>(baseUrl, `/admin/bidder-profiles/${id}`),
      markFeePaid: (id: string, body: BidderMarkFeePaidInput) =>
        request<BidderProfile>(
          baseUrl,
          `/admin/bidder-profiles/${id}/mark-fee-paid`,
          json('POST', body),
        ),
      approve: (id: string) =>
        request<BidderProfile>(baseUrl, `/admin/bidder-profiles/${id}/approve`, {
          method: 'POST',
        }),
      reject: (id: string, body: BidderRejectInput) =>
        request<BidderProfile>(
          baseUrl,
          `/admin/bidder-profiles/${id}/reject`,
          json('POST', body),
        ),
      listWallets: () =>
        request<BidderWalletRow[]>(baseUrl, '/admin/bidder-profiles/wallets'),
      search: (params: { q: string; excludeAttachedTo?: string }) => {
        const qs = new URLSearchParams({ q: params.q });
        if (params.excludeAttachedTo) qs.set('excludeAttachedTo', params.excludeAttachedTo);
        return request<BidderSearchResult[]>(
          baseUrl,
          `/admin/bidder-profiles/search?${qs}`,
        );
      },
      getWallet: (id: string) =>
        request<Wallet>(baseUrl, `/admin/bidder-profiles/${id}/wallet`),
      listWalletTxns: (id: string, params: { limit?: number; before?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.before) qs.set('before', params.before);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<WalletTransaction[]>(
          baseUrl,
          `/admin/bidder-profiles/${id}/wallet/transactions${suffix}`,
        );
      },
      creditWallet: (id: string, body: WalletCreditInput) =>
        request<{ wallet: Wallet; transaction: WalletTransaction }>(
          baseUrl,
          `/admin/bidder-profiles/${id}/wallet/credit`,
          json('POST', body),
        ),
      debitWallet: (id: string, body: WalletDebitInput) =>
        request<{ wallet: Wallet; transaction: WalletTransaction }>(
          baseUrl,
          `/admin/bidder-profiles/${id}/wallet/debit`,
          json('POST', body),
        ),
    },
    adminClients: {
      list: () => request<Client[]>(baseUrl, '/admin/clients'),
      get: (id: string) => request<ClientWithTnc>(baseUrl, `/admin/clients/${id}`),
      create: (body: ClientCreateInput) =>
        request<Client>(baseUrl, '/admin/clients', json('POST', body)),
      update: (id: string, body: ClientUpdateInput) =>
        request<Client>(baseUrl, `/admin/clients/${id}`, json('PATCH', body)),
      setConsolidatedEmdSetting: (id: string, allowsConsolidatedEmd: boolean) =>
        request<Client>(
          baseUrl,
          `/admin/clients/${id}/consolidated-emd-setting`,
          json('PATCH', { allowsConsolidatedEmd }),
        ),

      listLocations: (id: string) =>
        request<ClientLocationWithContacts[]>(baseUrl, `/admin/clients/${id}/locations`),
      createLocation: (id: string, body: ClientLocationCreateInput) =>
        request<ClientLocationWithContacts>(
          baseUrl,
          `/admin/clients/${id}/locations`,
          json('POST', body),
        ),
      updateLocation: (id: string, locationId: string, body: ClientLocationUpdateInput) =>
        request<ClientLocationWithContacts>(
          baseUrl,
          `/admin/clients/${id}/locations/${locationId}`,
          json('PATCH', body),
        ),
      deleteLocation: (id: string, locationId: string) =>
        request<void>(baseUrl, `/admin/clients/${id}/locations/${locationId}`, {
          method: 'DELETE',
        }),

      createContact: (id: string, locationId: string, body: ClientContactCreateInput) =>
        request<ClientContactPoint>(
          baseUrl,
          `/admin/clients/${id}/locations/${locationId}/contacts`,
          json('POST', body),
        ),
      updateContact: (
        id: string,
        locationId: string,
        contactId: string,
        body: ClientContactUpdateInput,
      ) =>
        request<ClientContactPoint>(
          baseUrl,
          `/admin/clients/${id}/locations/${locationId}/contacts/${contactId}`,
          json('PATCH', body),
        ),
      deleteContact: (id: string, locationId: string, contactId: string) =>
        request<void>(
          baseUrl,
          `/admin/clients/${id}/locations/${locationId}/contacts/${contactId}`,
          { method: 'DELETE' },
        ),

      listEngagements: (id: string) =>
        request<ClientEngagementWithUser[]>(baseUrl, `/admin/clients/${id}/engagements`),
      createEngagement: (id: string, body: ClientEngagementCreateInput) =>
        request<ClientEngagementWithUser>(
          baseUrl,
          `/admin/clients/${id}/engagements`,
          json('POST', body),
        ),
      updateEngagement: (
        id: string,
        engagementId: string,
        body: ClientEngagementUpdateInput,
      ) =>
        request<ClientEngagementWithUser>(
          baseUrl,
          `/admin/clients/${id}/engagements/${engagementId}`,
          json('PATCH', body),
        ),
      deleteEngagement: (id: string, engagementId: string) =>
        request<void>(baseUrl, `/admin/clients/${id}/engagements/${engagementId}`, {
          method: 'DELETE',
        }),

      getAuctionHistory: (id: string) =>
        request<AuctionHistoryResponse>(baseUrl, `/admin/clients/${id}/auction-history`),

      listInternalContacts: (id: string) =>
        request<ClientInternalContactAssignment[]>(
          baseUrl,
          `/admin/clients/${id}/internal-contacts`,
        ),
      setInternalContacts: (id: string, body: InternalContactsUpdateInput) =>
        request<ClientInternalContactAssignment[]>(
          baseUrl,
          `/admin/clients/${id}/internal-contacts`,
          json('PUT', body),
        ),
    },
    adminStaff: {
      list: () => request<AdminStaffMember[]>(baseUrl, '/admin/staff'),
    },
    adminAuctions: {
      list: (params: { clientId?: string; code?: string; status?: AuctionStatus } = {}) => {
        const qs = new URLSearchParams();
        if (params.clientId) qs.set('clientId', params.clientId);
        if (params.code) qs.set('code', params.code);
        if (params.status) qs.set('status', params.status);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<AuctionListRow[]>(baseUrl, `/admin/auctions${suffix}`);
      },
      get: (id: string) => request<AuctionDetail>(baseUrl, `/admin/auctions/${id}`),
      create: (body: CreateAuctionInput) =>
        request<Auction>(baseUrl, '/admin/auctions', json('POST', body)),
      update: (id: string, body: UpdateAuctionInput) =>
        request<Auction>(baseUrl, `/admin/auctions/${id}`, json('PATCH', body)),
      addLot: (id: string, body: CreateLotInput) =>
        request<Lot>(baseUrl, `/admin/auctions/${id}/lots`, json('POST', body)),
      updateLot: (id: string, lotId: string, body: UpdateLotInput) =>
        request<Lot>(baseUrl, `/admin/auctions/${id}/lots/${lotId}`, json('PATCH', body)),
      deleteLot: (id: string, lotId: string) =>
        request<void>(baseUrl, `/admin/auctions/${id}/lots/${lotId}`, { method: 'DELETE' }),

      // -- Participants ----------------------------------------------------
      listParticipants: (id: string) =>
        request<ParticipantsView>(baseUrl, `/admin/auctions/${id}/participants`),
      attachToLots: (id: string, body: AttachToLotsInput) =>
        request<AttachResult>(
          baseUrl,
          `/admin/auctions/${id}/participants/lots`,
          json('POST', body),
        ),
      attachToConsolidated: (id: string, body: AttachToConsolidatedInput) =>
        request<AttachResult>(
          baseUrl,
          `/admin/auctions/${id}/participants/consolidated`,
          json('POST', body),
        ),
      detachFromLot: (id: string, lotId: string, bidderProfileId: string) =>
        request<void>(
          baseUrl,
          `/admin/auctions/${id}/lots/${lotId}/participants/${bidderProfileId}`,
          { method: 'DELETE' },
        ),
      detachFromAuction: (id: string, bidderProfileId: string) =>
        request<void>(
          baseUrl,
          `/admin/auctions/${id}/participants/${bidderProfileId}`,
          { method: 'DELETE' },
        ),

      // -- Lifecycle -------------------------------------------------------
      end: (id: string) =>
        request<Auction>(baseUrl, `/admin/auctions/${id}/end`, { method: 'POST' }),
      cancel: (id: string, body: LotOutcomeNoteInput) =>
        request<Auction>(baseUrl, `/admin/auctions/${id}/cancel`, json('POST', body)),
      markLotLifted: (id: string, lotId: string, body: LotOutcomeNoteInput) =>
        request<Lot>(
          baseUrl,
          `/admin/auctions/${id}/lots/${lotId}/mark-lifted`,
          json('POST', body),
        ),
      forfeitLot: (id: string, lotId: string, body: LotOutcomeNoteInput) =>
        request<Lot>(
          baseUrl,
          `/admin/auctions/${id}/lots/${lotId}/forfeit`,
          json('POST', body),
        ),
      rejectLotByClient: (id: string, lotId: string, body: LotOutcomeNoteInput) =>
        request<Lot>(
          baseUrl,
          `/admin/auctions/${id}/lots/${lotId}/reject-by-client`,
          json('POST', body),
        ),
    },
    inventory: {
      listCategories: () => request<CategoryWithSubcategories[]>(baseUrl, '/categories'),
      createCategory: (body: CreateCategoryInput) =>
        request<{ id: string; name: string }>(baseUrl, '/categories', json('POST', body)),
      updateCategory: (id: string, body: { name?: string }) =>
        request<{ id: string }>(baseUrl, `/categories/${id}`, json('PATCH', body)),
      deleteCategory: (id: string) =>
        request<{ ok: true }>(baseUrl, `/categories/${id}`, { method: 'DELETE' }),

      createSubcategory: (body: CreateSubcategoryInput) =>
        request<{ id: string }>(baseUrl, '/subcategories', json('POST', body)),
      updateSubcategory: (id: string, body: { name?: string }) =>
        request<{ id: string }>(baseUrl, `/subcategories/${id}`, json('PATCH', body)),
      deleteSubcategory: (id: string) =>
        request<{ ok: true }>(baseUrl, `/subcategories/${id}`, { method: 'DELETE' }),
      suggestedAttributes: (subcategoryId: string) =>
        request<SuggestedAttributesResponse>(
          baseUrl,
          `/subcategories/${subcategoryId}/suggested-attributes`,
        ),

      listAttributes: () => request<AttributeListItem[]>(baseUrl, '/attributes'),
      getAttribute: (id: string) => request<AttributeListItem>(baseUrl, `/attributes/${id}`),
      createAttribute: (body: CreateAttributeInput) =>
        request<AttributeListItem>(baseUrl, '/attributes', json('POST', body)),
      updateAttribute: (id: string, body: UpdateAttributeInput) =>
        request<AttributeListItem>(baseUrl, `/attributes/${id}`, json('PATCH', body)),
      deleteAttribute: (id: string) =>
        request<{ ok: true }>(baseUrl, `/attributes/${id}`, { method: 'DELETE' }),

      listItems: (params: { subcategoryId?: string; categoryId?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.subcategoryId) qs.set('subcategoryId', params.subcategoryId);
        if (params.categoryId) qs.set('categoryId', params.categoryId);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<ItemListRow[]>(baseUrl, `/items${suffix}`);
      },
      getItem: (id: string) => request<ItemDetail>(baseUrl, `/items/${id}`),
      createItem: (body: CreateItemInput) =>
        request<ItemDetail>(baseUrl, '/items', json('POST', body)),
      updateItem: (id: string, body: UpdateItemInput) =>
        request<ItemDetail>(baseUrl, `/items/${id}`, json('PATCH', body)),
      deleteItem: (id: string) =>
        request<{ ok: true }>(baseUrl, `/items/${id}`, { method: 'DELETE' }),
      addAttributeValue: (itemId: string, body: ItemAttributeValueInput) =>
        request<{ id: string }>(baseUrl, `/items/${itemId}/attribute-values`, json('POST', body)),
      removeAttributeValue: (itemId: string, valueId: string) =>
        request<{ ok: true }>(baseUrl, `/items/${itemId}/attribute-values/${valueId}`, {
          method: 'DELETE',
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
