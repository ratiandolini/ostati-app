import { z } from "zod";

const georgianPhoneRegex = /^\d{9}$/;

export const emailLoginSchema = z.object({
  email: z.string().trim().email("სწორი ელ.ფოსტა შეიყვანეთ"),
  password: z.string().min(6, "პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს"),
});

export const phoneLoginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(georgianPhoneRegex, "მობილურის ნომერი უნდა იყოს 9 ციფრი"),
});

export const clientProfileSchema = z.object({
  firstName: z.string().trim().min(2, "სახელი მინიმუმ 2 სიმბოლო უნდა იყოს"),
  lastName: z.string().trim().min(2, "გვარი მინიმუმ 2 სიმბოლო უნდა იყოს"),
  contactPhone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || georgianPhoneRegex.test(value.replace(/\D/g, "")), {
      message: "მობილურის ნომერი უნდა იყოს 9 ციფრი",
    }),
  city: z.string().trim().min(2, "ქალაქი მიუთითეთ"),
  address: z.string().trim().min(4, "საცხოვრებელი მისამართი მიუთითეთ"),
});

export const bookingAddressSchema = z.object({
  visitAddress: z.string().trim().min(4, "სამუშაო მისამართის მითითება აუცილებელია"),
});

export const getValidationMessage = (error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};
