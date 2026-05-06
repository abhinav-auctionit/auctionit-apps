import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, createApiClient, type ApiClient } from '@auction/api-client';
import type {
  BidderRegisterInput,
  LoginInput,
  OtpVerifyEmailInput,
  OtpVerifyMobileInput,
  RegisterInput,
  User,
} from '@auction/types';

export type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<User>;
  loginEmailOtp: (input: OtpVerifyEmailInput) => Promise<User>;
  loginMobileOtp: (input: OtpVerifyMobileInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  registerBidder: (input: BidderRegisterInput) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ApiClientContext = createContext<ApiClient | null>(null);

const ME_KEY = ['auth', 'me'] as const;

export function AuthProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: ReactNode;
}) {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });

  const loginEmailOtpMutation = useMutation({
    mutationFn: (input: OtpVerifyEmailInput) => api.auth.loginEmailOtpVerify(input),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });

  const loginMobileOtpMutation = useMutation({
    mutationFn: (input: OtpVerifyMobileInput) => api.auth.loginMobileOtpVerify(input),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => api.auth.register(input),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });

  const registerBidderMutation = useMutation({
    mutationFn: (input: BidderRegisterInput) => api.auth.bidderRegister(input),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.clear();
    },
  });

  const value: AuthContextValue = {
    user: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    login: (input) => loginMutation.mutateAsync(input),
    loginEmailOtp: (input) => loginEmailOtpMutation.mutateAsync(input),
    loginMobileOtp: (input) => loginMobileOtpMutation.mutateAsync(input),
    register: (input) => registerMutation.mutateAsync(input),
    registerBidder: (input) => registerBidderMutation.mutateAsync(input),
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
  };

  return (
    <ApiClientContext.Provider value={api}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </ApiClientContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function useApiClient() {
  const ctx = useContext(ApiClientContext);
  if (!ctx) throw new Error('useApiClient must be used within <AuthProvider>');
  return ctx;
}
