import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@auction/ui';
import { ApiError, type BidderProfile, type StoredFile } from '@auction/api-client';
import { useApiClient, useAuth } from '@auction/auth';
import { bidderRegisterSchema } from '@auction/types';
import { StepIndicator } from '../components/wizard/StepIndicator';
import { OtpDialog } from '../components/wizard/OtpDialog';
import {
  PersonalStep,
  initialPersonalDraft,
  type PersonalDraft,
} from '../components/wizard/PersonalStep';
import {
  CompanyStep,
  initialCompanyDraft,
  type CompanyDraft,
} from '../components/wizard/CompanyStep';
import {
  DocumentsStep,
  initialDocumentsDraft,
  type DocumentsDraft,
} from '../components/wizard/DocumentsStep';
import {
  TermsStep,
  initialTermsDraft,
  type TermsDraft,
} from '../components/wizard/TermsStep';
import {
  PaymentStep,
  initialPaymentDraft,
  type PaymentDraft,
} from '../components/wizard/PaymentStep';
import type { StepId } from '../lib/wizard';

const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong';

export function RegisterPage() {
  const api = useApiClient();
  const { user, registerBidder } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<StepId>(user ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [personal, setPersonal] = useState<PersonalDraft>(initialPersonalDraft);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  // Steps 2–5
  const [company, setCompany] = useState<CompanyDraft>(initialCompanyDraft);
  const [documents, setDocuments] = useState<DocumentsDraft>(initialDocumentsDraft);
  const [terms, setTerms] = useState<TermsDraft>(initialTermsDraft);
  const [payment, setPayment] = useState<PaymentDraft>(initialPaymentDraft);

  const profileQuery = useQuery({
    queryKey: ['bidder', 'me', 'profile'],
    queryFn: () => api.bidder.getMyProfile(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const countriesQuery = useQuery({
    queryKey: ['bidder', 'countries'],
    queryFn: () => api.bidder.countries(),
    staleTime: 60 * 60 * 1000,
  });

  const profile = profileQuery.data;
  const isUnderReview = profile?.status === 'pending_approval';
  const isApproved = profile?.status === 'approved';

  useEffect(() => {
    if (isApproved) navigate('/', { replace: true });
  }, [isApproved, navigate]);

  useEffect(() => {
    if (!profile || profile.status === 'pending_approval' || profile.status === 'approved') return;
    setCompany((prev) => ({
      ...prev,
      companyName: profile.companyName ?? prev.companyName,
      companyType: profile.companyType ?? prev.companyType,
      businessActivity: profile.businessActivity ?? prev.businessActivity,
      address: profile.address ?? prev.address,
      country: (profile.country ?? prev.country) as CompanyDraft['country'],
      state: profile.state ?? prev.state,
      city: profile.city ?? prev.city,
      pinCode: profile.pinCode ?? prev.pinCode,
      designation: profile.designation ?? prev.designation,
      secondaryNumber: profile.secondaryNumber ?? prev.secondaryNumber,
      registeredEmail: profile.registeredEmail ?? prev.registeredEmail,
      gst: profile.gst ?? prev.gst,
      pan: profile.pan ?? prev.pan,
    }));
    setDocuments((prev) => ({
      ...prev,
      bankAccountNumber: profile.bankAccountNumber ?? prev.bankAccountNumber,
      bankName: profile.bankName ?? prev.bankName,
      ifscCode: profile.ifscCode ?? prev.ifscCode,
    }));
    setTerms((prev) => ({
      ...prev,
      termsAccepted: profile.termsAcceptedAt != null,
      signatoryName: profile.signatoryName ?? prev.signatoryName,
      signatoryDesignation: profile.signatoryDesignation ?? prev.signatoryDesignation,
      signatoryPlace: profile.signatoryPlace ?? prev.signatoryPlace,
      signatoryDate: profile.signatoryDate?.slice(0, 10) ?? prev.signatoryDate,
    }));
    setPayment({ subscriptionType: profile.subscriptionType ?? '' });
  }, [profile]);

  // Hydrate previously-uploaded file metadata so step 3 shows them on revisit.
  useEffect(() => {
    if (!profile) return;
    const ids: Array<[keyof DocumentsDraft, string | null]> = [
      ['panCardFile', profile.panCardFileId],
      ['proofOfAddressFile', profile.proofOfAddressFileId],
      ['cancelledChequeFile', profile.cancelledChequeFileId],
      ['otherFile', profile.otherFileId],
    ];
    Promise.all(
      ids.map(async ([key, id]) => {
        if (!id) return [key, null] as const;
        try {
          const f = await api.files.get(id);
          return [key, f] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    ).then((pairs) => {
      setDocuments((prev) => {
        const next = { ...prev };
        for (const [key, value] of pairs) {
          (next as Record<string, StoredFile | null | string>)[key as string] = value;
        }
        return next;
      });
    });
  }, [profile, api]);

  const target = useMemo(
    () => `${personal.mobileCountryCode}${personal.mobileNumber}`,
    [personal.mobileCountryCode, personal.mobileNumber],
  );

  // -- Step 1: send OTP --
  async function handlePersonalSubmit() {
    setError(null);
    if (personal.password !== personal.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const whatsappCode = personal.whatsappSameAsContact
      ? personal.mobileCountryCode
      : personal.whatsappCountryCode;
    const whatsappNum = personal.whatsappSameAsContact
      ? personal.mobileNumber
      : personal.whatsappNumber;
    const candidate = {
      verificationToken: '00000000-0000-0000-0000-000000000000',
      interestedIn: personal.interestedIn,
      fullName: personal.fullName,
      email: personal.email,
      mobileCountryCode: personal.mobileCountryCode,
      mobileNumber: personal.mobileNumber,
      whatsappCountryCode: whatsappCode,
      whatsappNumber: whatsappNum,
      password: personal.password,
      confirmPassword: personal.confirmPassword,
    };
    const parsed = bidderRegisterSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setBusy(true);
    try {
      await api.auth.bidderOtpSend({
        mobileCountryCode: personal.mobileCountryCode,
        mobileNumber: personal.mobileNumber,
      });
      setOtpError(null);
      setOtpOpen(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpResend() {
    setOtpBusy(true);
    setOtpError(null);
    try {
      await api.auth.bidderOtpSend({
        mobileCountryCode: personal.mobileCountryCode,
        mobileNumber: personal.mobileNumber,
      });
    } catch (e) {
      setOtpError(errorMessage(e));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleOtpVerify(code: string) {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const { verificationToken } = await api.auth.bidderOtpVerify({
        mobileCountryCode: personal.mobileCountryCode,
        mobileNumber: personal.mobileNumber,
        code,
      });
      const whatsappCode = personal.whatsappSameAsContact
        ? personal.mobileCountryCode
        : personal.whatsappCountryCode;
      const whatsappNum = personal.whatsappSameAsContact
        ? personal.mobileNumber
        : personal.whatsappNumber;
      await registerBidder({
        verificationToken,
        interestedIn: personal.interestedIn,
        fullName: personal.fullName,
        email: personal.email,
        mobileCountryCode: personal.mobileCountryCode,
        mobileNumber: personal.mobileNumber,
        whatsappCountryCode: whatsappCode,
        whatsappNumber: whatsappNum,
        password: personal.password,
        confirmPassword: personal.confirmPassword,
      });
      setOtpOpen(false);
      // Pre-fill step 2 registered email + signatory name from step 1.
      setCompany((prev) => ({ ...prev, registeredEmail: personal.email }));
      setTerms((prev) => ({ ...prev, signatoryName: personal.fullName }));
      setStep(2);
    } catch (e) {
      setOtpError(errorMessage(e));
    } finally {
      setOtpBusy(false);
    }
  }

  // -- Step 2: company --
  async function handleCompanySubmit() {
    setError(null);
    setBusy(true);
    try {
      await api.bidder.patchMyProfile({
        companyName: company.companyName,
        companyType: company.companyType || undefined,
        businessActivity: company.businessActivity || undefined,
        address: company.address,
        country: company.country || undefined,
        state: company.state,
        city: company.city,
        pinCode: company.pinCode,
        designation: company.designation,
        secondaryNumber: company.secondaryNumber || null,
        registeredEmail: company.registeredEmail,
        gst: company.gst,
        pan: company.pan,
      });
      await profileQuery.refetch();
      setStep(3);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // -- Step 3: documents --
  async function handleDocumentsSubmit() {
    setError(null);
    if (
      !documents.panCardFile ||
      !documents.proofOfAddressFile ||
      !documents.cancelledChequeFile
    ) {
      setError('PAN Card, Proof of Address and Cancelled Cheque are required.');
      return;
    }
    setBusy(true);
    try {
      await api.bidder.patchMyProfile({
        panCardFileId: documents.panCardFile.id,
        proofOfAddressFileId: documents.proofOfAddressFile.id,
        cancelledChequeFileId: documents.cancelledChequeFile.id,
        otherFileId: documents.otherFile?.id ?? null,
        bankAccountNumber: documents.bankAccountNumber,
        bankName: documents.bankName,
        ifscCode: documents.ifscCode,
      });
      await profileQuery.refetch();
      setStep(4);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // -- Step 4: terms --
  async function handleTermsSubmit() {
    setError(null);
    if (!terms.termsAccepted) {
      setError('You must accept the terms to proceed.');
      return;
    }
    setBusy(true);
    try {
      await api.bidder.patchMyProfile({
        termsAccepted: true,
        signatoryName: terms.signatoryName,
        signatoryDesignation: terms.signatoryDesignation,
        signatoryPlace: terms.signatoryPlace,
        signatoryDate: new Date(terms.signatoryDate),
      });
      await profileQuery.refetch();
      setStep(5);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // -- Step 5: payment + submit --
  async function handlePaymentSubmit() {
    setError(null);
    if (!payment.subscriptionType) {
      setError('Pick a subscription option.');
      return;
    }
    setBusy(true);
    try {
      await api.bidder.patchMyProfile({ subscriptionType: payment.subscriptionType });
      await api.bidder.submitMyProfile();
      await profileQuery.refetch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (isApproved) {
    return null;
  }

  if (isUnderReview) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Application submitted</CardTitle>
            <CardDescription>
              Thanks{profile?.fullName ? `, ${profile.fullName}` : ''}. Our team will review your
              details and confirm receipt of the registration fee. You'll be able to bid once your
              account is approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/', { replace: true })}>Go to dashboard</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="bg-background py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Bidder Registration</CardTitle>
              <CardDescription>
                Complete all five steps to submit your application for review.
              </CardDescription>
            </div>
            <StepIndicator current={step} />
          </CardHeader>
          <CardContent>
            {profile?.status === 'rejected' && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Application was rejected.</p>
                {profile.rejectionNote && (
                  <p className="mt-1 text-muted-foreground">{profile.rejectionNote}</p>
                )}
                <p className="mt-2 text-muted-foreground">
                  Update the relevant details and resubmit.
                </p>
              </div>
            )}

            {step === 1 && (
              <PersonalStep
                value={personal}
                onChange={setPersonal}
                onSubmit={handlePersonalSubmit}
                busy={busy}
                error={error}
              />
            )}
            {step === 2 && (
              <CompanyStep
                value={company}
                onChange={setCompany}
                countries={countriesQuery.data}
                onBack={() => setStep(user ? 2 : 1)}
                onSubmit={handleCompanySubmit}
                busy={busy}
                error={error}
              />
            )}
            {step === 3 && (
              <DocumentsStep
                value={documents}
                onChange={setDocuments}
                onBack={() => setStep(2)}
                onSubmit={handleDocumentsSubmit}
                busy={busy}
                error={error}
              />
            )}
            {step === 4 && (
              <TermsStep
                value={terms}
                onChange={setTerms}
                onBack={() => setStep(3)}
                onSubmit={handleTermsSubmit}
                busy={busy}
                error={error}
              />
            )}
            {step === 5 && (
              <PaymentStep
                value={payment}
                onChange={setPayment}
                onBack={() => setStep(4)}
                onSubmit={handlePaymentSubmit}
                busy={busy}
                error={error}
              />
            )}

            {!user && step === 1 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary underline">
                  Sign in
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <OtpDialog
        open={otpOpen}
        target={target}
        busy={otpBusy}
        error={otpError}
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        onCancel={() => setOtpOpen(false)}
      />
    </main>
  );
}
