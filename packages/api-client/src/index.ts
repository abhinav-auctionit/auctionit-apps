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
} from '@auction/types';

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
  hsnCode: string | null;
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
