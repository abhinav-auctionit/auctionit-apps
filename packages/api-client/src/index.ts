import type {
  AttributeType,
  CreateAttributeInput,
  CreateCategoryInput,
  CreateItemInput,
  CreateSubcategoryInput,
  CreateUserInput,
  ItemAttributeValueInput,
  LoginInput,
  RegisterInput,
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
    },
    taxonomy: {
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
