import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Work email is required')
    .email('Enter a valid work email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const OTP_LENGTH = 6;

export const otpSchema = z
  .string()
  .length(OTP_LENGTH, `Enter the ${OTP_LENGTH}-digit code`)
  .regex(/^\d+$/, 'The code contains digits only');
