export type BookingQuestionKey =
  | "wallCondition"
  | "targetSurface"
  | "materialOwner"
  | "plumbingType"
  | "floor"
  | "electricPoints"
  | "electricPanel"
  | "isEmergency"
  | "workScope"
  | "surfaceType"
  | "materialNote"
  | "itemCount"
  | "currentCondition"
  | "photoNote"
  | "roofType";

export interface BookingQuestionField {
  key: BookingQuestionKey;
  label: string;
  placeholder: string;
}

const questionCatalog: Record<string, BookingQuestionField[]> = {
  "ავეჯის ხელოსანი": [
    {
      key: "workScope",
      label: "რა ტიპის ავეჯია",
      placeholder: "კარადა, სამზარეულო, მაგიდა...",
    },
    {
      key: "itemCount",
      label: "რამდენი ერთეულია",
      placeholder: "მაგ: 2 კარადა",
    },
    {
      key: "materialNote",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  "ალუმინის კარ-ფანჯარა": [
    {
      key: "workScope",
      label: "რა გჭირდებათ",
      placeholder: "მონტაჟი, შეკეთება, შეცვლა...",
    },
    {
      key: "itemCount",
      label: "რაოდენობა",
      placeholder: "მაგ: 3 ფანჯარა, 1 კარი",
    },
    {
      key: "currentCondition",
      label: "მდგომარეობა",
      placeholder: "ძველი ჩარჩოა, ახალი მონტაჟია...",
    },
  ],
  "ბეტონის სამუშაოები": [
    {
      key: "workScope",
      label: "სამუშაოს ტიპი",
      placeholder: "მოჭიმვა, საძირკველი, კიბე...",
    },
    {
      key: "surfaceType",
      label: "სად კეთდება",
      placeholder: "ბინა, ეზო, აივანი, კომერციული ფართი...",
    },
    {
      key: "materialNote",
      label: "მასალა/ტექნიკა",
      placeholder: "მასალა ადგილზეა თუ მოსატანია...",
    },
  ],
  "გათბობა-გაგრილება": [
    {
      key: "workScope",
      label: "საქმის ტიპი",
      placeholder: "მონტაჟი, შეკეთება, დიაგნოსტიკა...",
    },
    {
      key: "itemCount",
      label: "მოწყობილობა/წერტილები",
      placeholder: "მაგ: 2 რადიატორი, 1 კონდიციონერი",
    },
    {
      key: "isEmergency",
      label: "სასწრაფოა?",
      placeholder: "კი / არა",
    },
  ],
  გიფსოკარდონი: [
    {
      key: "targetSurface",
      label: "რის გაკეთება გსურთ",
      placeholder: "ჭერი, კედელი, ტიხარი...",
    },
    {
      key: "surfaceType",
      label: "ფართის მდგომარეობა",
      placeholder: "შავი კარკასი, რემონტიანი ფართი...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  დემონტაჟი: [
    {
      key: "workScope",
      label: "რა უნდა დაიშალოს",
      placeholder: "კედელი, იატაკი, კაფელი, ავეჯი...",
    },
    {
      key: "surfaceType",
      label: "ნარჩენების გატანა",
      placeholder: "საჭიროა / არ არის საჭირო",
    },
    {
      key: "floor",
      label: "სართული",
      placeholder: "მაგ: 4, ლიფტი არის/არ არის",
    },
  ],
  დიზაინერი: [
    {
      key: "workScope",
      label: "რა გჭირდებათ",
      placeholder: "გეგმარება, ვიზუალიზაცია, სრული პროექტი...",
    },
    {
      key: "surfaceType",
      label: "ობიექტის ტიპი",
      placeholder: "ბინა, სახლი, ოფისი...",
    },
    {
      key: "materialNote",
      label: "სასურველი სტილი/ბიუჯეტი",
      placeholder: "თანამედროვე, კლასიკური, მინიმალისტური...",
    },
  ],
  დურგალი: [
    {
      key: "workScope",
      label: "რა ტიპის საქმეა",
      placeholder: "კარი, ავეჯი, კარადა, პარკეტი...",
    },
    {
      key: "itemCount",
      label: "რაოდენობა",
      placeholder: "მაგ: 2 კარი, 1 კარადა",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  მალიარი: [
    {
      key: "wallCondition",
      label: "კედლის მდგომარეობა",
      placeholder: "მაგ: ძველი საღებავი, ბზარები...",
    },
    {
      key: "targetSurface",
      label: "რას ეხება საქმე",
      placeholder: "კედელი, ჭერი, ფასადი...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  სანტექნიკოსი: [
    {
      key: "plumbingType",
      label: "საქმის ტიპი",
      placeholder: "გაჟონვა, მონტაჟი, შეცვლა...",
    },
    {
      key: "floor",
      label: "სართული",
      placeholder: "მაგ: 5, ლიფტი არის/არ არის",
    },
    {
      key: "photoNote",
      label: "ფოტო/აღწერა",
      placeholder: "თუ ფოტო გაქვთ, აღწერეთ რა ჩანს ან მიუთითეთ ლინკი",
    },
  ],
  ელექტრიკოსი: [
    {
      key: "electricPoints",
      label: "წერტილების რაოდენობა",
      placeholder: "მაგ: 8",
    },
    {
      key: "electricPanel",
      label: "ელ. ფარის მდგომარეობა",
      placeholder: "ძველი, ახალი, შესაცვლელი...",
    },
    {
      key: "isEmergency",
      label: "ავარიულია?",
      placeholder: "კი / არა",
    },
  ],
  "თაბაშირ-მუყაო": [
    {
      key: "targetSurface",
      label: "რის გაკეთება გსურთ",
      placeholder: "ჭერი, კედელი, ტიხარი...",
    },
    {
      key: "currentCondition",
      label: "არსებული მდგომარეობა",
      placeholder: "კარკასი მზადაა, შავი კედელია...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  იზოლაცია: [
    {
      key: "surfaceType",
      label: "იზოლაციის ადგილი",
      placeholder: "სახურავი, კედელი, სველი წერტილი...",
    },
    {
      key: "currentCondition",
      label: "პრობლემა",
      placeholder: "ნესტი, გაჟონვა, სითბოს დაკარგვა...",
    },
    {
      key: "materialNote",
      label: "მასალა",
      placeholder: "მასალა გაქვთ თუ შესარჩევია...",
    },
  ],
  "იატაკის დაგება": [
    {
      key: "surfaceType",
      label: "იატაკის ტიპი",
      placeholder: "ლამინატი, გრანიტი, პარკეტი...",
    },
    {
      key: "currentCondition",
      label: "საფუძვლის მდგომარეობა",
      placeholder: "სწორია, მოსასწორებელია, ძველი იატაკია...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  "კარ-ფანჯრის მონტაჟი": [
    {
      key: "workScope",
      label: "რა მონტაჟდება",
      placeholder: "კარი, ფანჯარა, შიდა კარი...",
    },
    {
      key: "itemCount",
      label: "რაოდენობა",
      placeholder: "მაგ: 4 ფანჯარა",
    },
    {
      key: "currentCondition",
      label: "მდგომარეობა",
      placeholder: "ძველი უნდა მოიხსნას, ღიობი მზადაა...",
    },
  ],
  კაფელები: [
    {
      key: "targetSurface",
      label: "სად იგება",
      placeholder: "აბაზანა, სამზარეულო, იატაკი, კედელი...",
    },
    {
      key: "currentCondition",
      label: "ზედაპირის მდგომარეობა",
      placeholder: "ძველი კაფელია, შავი კედელია, მოსასწორებელია...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  "მეტალის კონსტრუქციები": [
    {
      key: "workScope",
      label: "კონსტრუქციის ტიპი",
      placeholder: "კიბე, მოაჯირი, კარი, ჩარჩო...",
    },
    {
      key: "itemCount",
      label: "რაოდენობა/ზომები",
      placeholder: "მაგ: 1 მოაჯირი, 6 მეტრი",
    },
    {
      key: "materialNote",
      label: "მასალა",
      placeholder: "მასალა ადგილზეა თუ დასამზადებელია...",
    },
  ],
  "მინების ხელოსანი": [
    {
      key: "workScope",
      label: "რა გჭირდებათ",
      placeholder: "შეცვლა, მონტაჟი, ჭრა...",
    },
    {
      key: "itemCount",
      label: "რაოდენობა/ზომები",
      placeholder: "მაგ: 2 მინა, 80x120",
    },
    {
      key: "currentCondition",
      label: "მდგომარეობა",
      placeholder: "გატეხილია, ბზარია, ახალი მონტაჟია...",
    },
  ],
  მონტაჟი: [
    {
      key: "workScope",
      label: "რა უნდა დამონტაჟდეს",
      placeholder: "თარო, ტელევიზორი, ტექნიკა...",
    },
    {
      key: "itemCount",
      label: "რაოდენობა",
      placeholder: "მაგ: 3 ერთეული",
    },
    {
      key: "surfaceType",
      label: "კედლის/ადგილის ტიპი",
      placeholder: "ბეტონი, აგური, გიფსი...",
    },
  ],
  "მოსაპირკეთებელი სამუშაოები": [
    {
      key: "targetSurface",
      label: "რის მოპირკეთება გსურთ",
      placeholder: "კედელი, იატაკი, ფასადი...",
    },
    {
      key: "currentCondition",
      label: "ზედაპირის მდგომარეობა",
      placeholder: "მოსამზადებელია, სუფთაა, ძველია...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  სახურავი: [
    {
      key: "roofType",
      label: "სახურავის ტიპი",
      placeholder: "თუნუქი, კრამიტი, ბრტყელი სახურავი...",
    },
    {
      key: "workScope",
      label: "საქმის ტიპი",
      placeholder: "შეკეთება, მონტაჟი, გაჟონვა...",
    },
    {
      key: "isEmergency",
      label: "სასწრაფოა?",
      placeholder: "კი / არა",
    },
  ],
  "სარემონტო ბრიგადა": [
    {
      key: "workScope",
      label: "რემონტის მოცულობა",
      placeholder: "სრული რემონტი, ნაწილობრივი, შავი კარკასი...",
    },
    {
      key: "surfaceType",
      label: "ობიექტის ტიპი",
      placeholder: "ბინა, სახლი, ოფისი...",
    },
    {
      key: "materialNote",
      label: "ბიუჯეტი/მასალა",
      placeholder: "მასალა ვისია, ბიუჯეტის დიაპაზონი...",
    },
  ],
  შპალერი: [
    {
      key: "wallCondition",
      label: "კედლის მდგომარეობა",
      placeholder: "შპალერი მოსახსნელია, კედელი გასასწორებელია...",
    },
    {
      key: "targetSurface",
      label: "რას ეხება საქმე",
      placeholder: "გაკრობა, მოხსნა, მომზადება...",
    },
    {
      key: "materialOwner",
      label: "შპალერი/წებო ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  "ჭერის ხელოსანი": [
    {
      key: "targetSurface",
      label: "ჭერის ტიპი",
      placeholder: "გაჭიმული, გიფსი, შეღებვა...",
    },
    {
      key: "currentCondition",
      label: "მდგომარეობა",
      placeholder: "ძველი ჭერია, ახალი მონტაჟია...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
  "ხის იატაკი": [
    {
      key: "surfaceType",
      label: "სამუშაოს ტიპი",
      placeholder: "დაგება, ციკლოვკა, ლაქი, შეკეთება...",
    },
    {
      key: "currentCondition",
      label: "იატაკის მდგომარეობა",
      placeholder: "ახალი დასაგებია, ძველია, ჭრიალებს...",
    },
    {
      key: "materialOwner",
      label: "მასალა ვისია",
      placeholder: "ჩემი, ხელოსნის, შესათანხმებელია",
    },
  ],
};

export const getBookingQuestionFields = (profession: string) => {
  const matchedKey = Object.keys(questionCatalog).find((key) =>
    profession.includes(key)
  );

  return matchedKey ? questionCatalog[matchedKey] : [];
};
