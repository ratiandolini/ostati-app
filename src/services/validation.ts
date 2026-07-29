import { z } from "zod";

const georgianPhoneRegex = /^\d{9}$/;
const optionalNumericText = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || Number.isFinite(Number(value)), {
      message: `${label} რიცხვით მიუთითეთ`,
    });

const starScore = z
  .number()
  .min(1, "ყველა კრიტერიუმზე მინიმუმ 1 ვარსკვლავი მონიშნეთ")
  .max(5, "შეფასება მაქსიმუმ 5 ვარსკვლავია");

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

export const craftsmanProfileSchema = z
  .object({
    firstName: z.string().trim().min(2, "სახელი მინიმუმ 2 სიმბოლო უნდა იყოს"),
    lastName: z.string().trim().min(2, "გვარი მინიმუმ 2 სიმბოლო უნდა იყოს"),
    contactPhone: z
      .string()
      .trim()
      .regex(georgianPhoneRegex, "მობილურის ნომერი უნდა იყოს 9 ციფრი"),
    city: z.string().trim().min(2, "ქალაქი მიუთითეთ"),
    professions: z
      .array(z.string().trim().min(1))
      .min(1, "მინიმუმ ერთი პროფესია მონიშნეთ"),
    experienceYears: z
      .number()
      .min(0, "სტაჟი უარყოფითი ვერ იქნება")
      .max(60, "სტაჟი გადაამოწმეთ"),
    priceType: z.enum(["fixed", "from", "range"]),
    priceMin: z.number().min(1, "საფასურში მინიმუმ 1 ლარი მიუთითეთ"),
    priceMax: z.number().nullable(),
    workDays: z.array(z.string()).min(1, "მინიმუმ ერთი სამუშაო დღე მონიშნეთ"),
    workStart: z.string().regex(/^\d{2}:\d{2}$/, "სამუშაოს დაწყების დრო გადაამოწმეთ"),
    workEnd: z.string().regex(/^\d{2}:\d{2}$/, "სამუშაოს დასრულების დრო გადაამოწმეთ"),
  })
  .refine(
    (profile) =>
      profile.priceType !== "range" ||
      profile.priceMax == null ||
      profile.priceMax >= profile.priceMin,
    {
      message: "მაქსიმუმი მინიმუმზე ნაკლები ვერ იქნება",
      path: ["priceMax"],
    }
  )
  .refine((profile) => profile.workStart < profile.workEnd, {
    message: "სამუშაოს დასრულების დრო დაწყებაზე გვიან უნდა იყოს",
    path: ["workEnd"],
  });

export const bookingAddressSchema = z.object({
  visitAddress: z.string().trim().min(4, "სამუშაო მისამართის მითითება აუცილებელია"),
});

export const bookingDetailsSchema = bookingAddressSchema.extend({
  area: optionalNumericText("სამუშაო ფართი"),
  height: optionalNumericText("სამუშაო სიმაღლე"),
  length: optionalNumericText("სამუშაო სიგრძე"),
  rooms: optionalNumericText("ოთახების რაოდენობა"),
  floor: optionalNumericText("სართული"),
  electricPoints: optionalNumericText("წერტილების რაოდენობა"),
});

export const cancellationSchema = z.object({
  reason: z.string().trim().min(3, "გაუქმების მიზეზი აირჩიეთ"),
});

export const disputeSchema = z.object({
  reason: z.string().trim().min(3, "პრობლემის მიზეზი აირჩიეთ"),
  details: z
    .string()
    .trim()
    .min(12, "აღწერაში მინიმუმ 12 სიმბოლო დაწერეთ, რომ Admin-მა საკითხი გაიგოს"),
});

export const craftsmanReviewSchema = z.object({
  quality: starScore,
  punctuality: starScore,
  cleanliness: starScore,
  deadline: starScore,
});

export const clientReviewSchema = z.object({
  communication: starScore,
  timeManagement: starScore,
  clarity: starScore,
});

export const getValidationMessage = (error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};
