import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(255).trim(),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'client', 'bidder']),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(255).trim(),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'client', 'bidder']),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

const countryCodeSchema = z.string().regex(/^\+\d{1,3}$/, 'invalid country code');
const mobileNumberSchema = z
  .string()
  .regex(/^\d{7,15}$/, 'mobile must be 7-15 digits with no spaces or dashes');
const otpCodeSchema = z.string().regex(/^\d{6}$/, 'otp must be 6 digits');

export const otpSendMobileSchema = z.object({
  mobileCountryCode: countryCodeSchema,
  mobileNumber: mobileNumberSchema,
});
export type OtpSendMobileInput = z.infer<typeof otpSendMobileSchema>;

export const otpVerifyMobileSchema = otpSendMobileSchema.extend({
  code: otpCodeSchema,
});
export type OtpVerifyMobileInput = z.infer<typeof otpVerifyMobileSchema>;

export const otpSendEmailSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});
export type OtpSendEmailInput = z.infer<typeof otpSendEmailSchema>;

export const otpVerifyEmailSchema = otpSendEmailSchema.extend({
  code: otpCodeSchema,
});
export type OtpVerifyEmailInput = z.infer<typeof otpVerifyEmailSchema>;

export const interestedInSchema = z.enum(['forward', 'reverse', 'both']);
export type InterestedIn = z.infer<typeof interestedInSchema>;

export const bidderRegisterSchema = z
  .object({
    verificationToken: z.string().uuid(),
    interestedIn: interestedInSchema,
    fullName: z.string().min(1).max(255).trim(),
    email: z.string().email().toLowerCase().trim(),
    mobileCountryCode: countryCodeSchema,
    mobileNumber: mobileNumberSchema,
    whatsappCountryCode: countryCodeSchema,
    whatsappNumber: mobileNumberSchema,
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'passwords do not match',
    path: ['confirmPassword'],
  });
export type BidderRegisterInput = z.infer<typeof bidderRegisterSchema>;
