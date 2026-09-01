import { Worker } from "../types";

export const workers: Worker[] = [
  {
    id: 1,
    name: "გიორგი ბერიძე",
    role: "მალიარი",
    avatar: "https://images.unsplash.com/photo-1615109398623-88346a601842?w=200&auto=format&fit=crop",
    avatarColor: "#3B82F6",
    exp: 12,
    rating: 4.8,
    reviewCount: 47,
    status: "free",
    city: "თბილისი",
    phone: "+995 555 12 34 56",
    about: "12 წლის გამოცდილება ინტერიერისა და ფასადის მოხატვაში.",
    price: "40 ლარი",
    skills: ["ინტერიერი", "ფასადი", "ევრო სტანდარტი", "ტექსტურა"],
    busyDays: [3, 4, 10, 11, 17, 18],
    reviews: [
      {
        author: "ნინო კ.",
        text: "ძალიან კარგი სამუშაო! სუფთა, ზუსტი.",
        date: "15 აპრ 2025",
        stars: 5,
      },
      {
        author: "დავით მ.",
        text: "შედეგი ბრწყინვალეა.",
        date: "2 მარ 2025",
        stars: 5,
      },
      {
        author: "ანა ლ.",
        text: "კარგი ოსტატია, ოდნავ დაიგვიანა.",
        date: "10 იან 2025",
        stars: 4,
      },
    ],
  },
  {
    id: 2,
    name: "ლევან ქაჯაია",
    role: "სანტექნიკოსი",
    avatar: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=200&auto=format&fit=crop",
    avatarColor: "#10B981",
    exp: 8,
    rating: 4.6,
    reviewCount: 31,
    status: "busy",
    city: "თბილისი",
    phone: "+995 577 98 76 54",
    about: "სანტექნიკური სამუშაოები, ონკანები, მილები, ბოილერები.",
    price: "40 ლარიდან",
    skills: ["მილები", "ბოილერი", "ონკანები", "სასწრაფო"],
    busyDays: [1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 21, 22],
    reviews: [
      {
        author: "მარინა გ.",
        text: "სწრაფად მოვიდა, ბოილერი შეაკეთა.",
        date: "20 აპრ 2025",
        stars: 5,
      },
      {
        author: "ვახტანგ ს.",
        text: "პროფესიონალი, კარგად გააკეთა.",
        date: "8 მარ 2025",
        stars: 4,
      },
    ],
  },
  {
    id: 3,
    name: "ზაზა მამუკელაშვილი",
    role: "ელექტრიკოსი",
    avatar: "https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=200&auto=format&fit=crop",
    avatarColor: "#F59E0B",
    exp: 15,
    rating: 4.9,
    reviewCount: 89,
    status: "free",
    city: "რუსთავი",
    phone: "+995 591 45 67 89",
    about: "15 წლის სტაჟი. ბინის სრული განახლება, პანელი.",
    price: "40-60 ლარი",
    skills: ["პანელი", "გასაყვანი", "სრული განახლება", "ლიცენზია"],
    busyDays: [5, 6, 12, 13, 19, 20, 26, 27],
    reviews: [
      {
        author: "ირმა ც.",
        text: "ზაზა ძალიან გამოცდილია!",
        date: "25 აპრ 2025",
        stars: 5,
      },
      {
        author: "გიგა ბ.",
        text: "ღირე ყოველ გროშს.",
        date: "1 აპრ 2025",
        stars: 5,
      },
      {
        author: "ნათია თ.",
        text: "სწრაფი, ზუსტი, ხელმისაწვდომი.",
        date: "15 მარ 2025",
        stars: 5,
      },
    ],
  },
  {
    id: 4,
    name: "სოფო ჯაფარიძე",
    role: "მალიარი",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop",
    avatarColor: "#8B5CF6",
    exp: 5,
    rating: 4.3,
    reviewCount: 18,
    status: "free",
    city: "მცხეთა",
    phone: "+995 555 33 44 55",
    about: "ინტერიერის მოხატვა, ოთახები. ყველა ბიუჯეტში.",
    price: "50 ლარი",
    skills: ["ინტერიერი", "კოლუმბი", "მოლასტურება", "ეკო საღებავი"],
    busyDays: [8, 9, 10],
    reviews: [
      {
        author: "ეკა ნ.",
        text: "კარგად გააკეთა ოთახი.",
        date: "18 აპრ 2025",
        stars: 4,
      },
      {
        author: "ლუკა მ.",
        text: "ფასი ხელმისაწვდომია.",
        date: "5 მარ 2025",
        stars: 4,
      },
    ],
  },
  {
    id: 5,
    name: "ბექა ჩხეიძე",
    role: "დურგალი",
    avatar: "https://images.unsplash.com/photo-1600488999585-e4364713b90a?w=200&auto=format&fit=crop",
    avatarColor: "#EF4444",
    exp: 20,
    rating: 4.7,
    reviewCount: 62,
    status: "booked",
    city: "თბილისი",
    phone: "+995 577 22 11 33",
    about: "ავეჯის დამზადება, კარ-ფანჯრის მონტაჟი.",
    price: "60 ლარიდან",
    skills: ["ავეჯი", "კარ-ფანჯარა", "კუხნის კარადა", "პარკეტი"],
    busyDays: Array.from({ length: 22 }, (_, i) => i + 1),
    reviews: [
      {
        author: "ნიკა ჯ.",
        text: "საოცარი კუხნის კარადა გააკეთა!",
        date: "22 აპრ 2025",
        stars: 5,
      },
      {
        author: "თამარ ო.",
        text: "ყველაფერი სრულყოფილია.",
        date: "10 მარ 2025",
        stars: 5,
      },
    ],
  },
  {
    id: 6,
    name: "გურამ ხოსიტაშვილი",
    role: "კაფელები",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop",
    avatarColor: "#06B6D4",
    exp: 10,
    rating: 4.5,
    reviewCount: 35,
    status: "free",
    city: "თბილისი",
    phone: "+995 598 77 88 99",
    about: "ლამინატი, პარკეტი, კერამიკული პლიტა.",
    price: "70-110 ლარი",
    skills: ["ლამინატი", "პარკეტი", "პლიტა", "კერამიკა"],
    busyDays: [7, 8, 9, 15, 16],
    reviews: [
      {
        author: "ანა ბ.",
        text: "ლამინატი შესანიშნავად დადო.",
        date: "30 აპრ 2025",
        stars: 5,
      },
      {
        author: "კახა ვ.",
        text: "პლიტა პროფესიონალმა დადო.",
        date: "20 მარ 2025",
        stars: 4,
      },
    ],
  },
];

export interface ServiceSubcategory {
  label: string;
  searchTerms?: readonly string[];
}

export interface CategoryGroup {
  id: string;
  label: string;
  icon: string;
  image: string;
  professions: readonly string[];
  subcategories: readonly ServiceSubcategory[];
  legacyProfessions?: readonly string[];
}

const allForCategory = (categoryLabel: string) => `ყველაფერს - ${categoryLabel}`;

// This is the single repair-services catalogue used by client requests, worker
// profiles and search. Legacy profession values remain supported below.
export const categoryGroups: readonly CategoryGroup[] = [
  { id: "electric", label: "ელექტრო სამუშაოები", icon: "⚡", image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=480&auto=format&fit=crop", legacyProfessions: ["ელექტრიკოსი"], subcategories: [
    { label: "ელექტრო გაყვანილობა", searchTerms: ["გაყვანილობა", "დენი", "კაბელი"] }, { label: "ელექტრო ფარი", searchTerms: ["ფარი", "ავტომატი"] }, { label: "როზეტი და ჩამრთველი", searchTerms: ["როზეტი", "შტეფსელი", "ჩამრთველი", "выключатель", "socket"] }, { label: "ჭაღი და განათება", searchTerms: ["ჭაღი", "ნათურა", "განათება"] }, { label: "საკაბელო ხაზები", searchTerms: ["საკაბელო", "ინტერნეტის კაბელი"] }, { label: "Smart Home", searchTerms: ["სმარტ ჰოუმ", "ჭკვიანი სახლი"] }, { label: "გენერატორი და UPS", searchTerms: ["გენერატორი", "იუპიესი", "ups"] }, { label: "სხვა" },
  ] },
  { id: "plumbing", label: "სანტექნიკა", icon: "◌", image: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=480&auto=format&fit=crop", legacyProfessions: ["სანტექნიკოსი"], subcategories: [
    { label: "წყლის მილები", searchTerms: ["მილები", "მილი", "წყალი"] }, { label: "გაჟონვის შეკეთება", searchTerms: ["გაჟონვა", "ჟონავს"] }, { label: "ონკანი", searchTerms: ["ონკანი", "კრანი"] }, { label: "ნიჟარა, უნიტაზი და აბაზანა", searchTerms: ["უნიტაზი", "ტუალეტი", "ნიჟარა", "ხელსაბანი", "აბაზანა", "ვანა", "დუში"] }, { label: "კანალიზაცია", searchTerms: ["კანალიზაცია", "სანიაღვრე"] }, { label: "ბოილერი", searchTerms: ["ბოილერი", "წყლის გამაცხელებელი"] }, { label: "ტუმბო და წყლის ავზი", searchTerms: ["ტუმბო", "წყლის ავზი"] }, { label: "სხვა" },
  ] },
  { id: "painting-walls", label: "შეღებვა და კედლები", icon: "▦", image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=480&auto=format&fit=crop", legacyProfessions: ["მალიარი", "შპალერი", "თაბაშირ-მუყაო"], subcategories: [
    { label: "კედლის/ჭერის შეღებვა", searchTerms: ["შეღებვა", "მალიარი", "კედლის შეღებვა", "ჭერის შეღებვა"] }, { label: "ფასადის შეღებვა", searchTerms: ["ფასადის შეღებვა", "ფასადი"] }, { label: "შპალერი" }, { label: "დეკორატიული ბათქაში", searchTerms: ["ბათქაში", "დეკორატიული"] }, { label: "კედლის გასწორება", searchTerms: ["კედლის გასწორება", "გასწორება"] }, { label: "კედლის მომზადება", searchTerms: ["გრუნტი", "მომზადება"] }, { label: "სხვა" },
  ] },
  { id: "full-renovation", label: "სრული რემონტი", icon: "✚", image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=480&auto=format&fit=crop", legacyProfessions: ["სარემონტო ბრიგადა", "მოსაპირკეთებელი სამუშაოები"], subcategories: [
    { label: "ბინის სრული რემონტი", searchTerms: ["ბინის რემონტი", "სრული რემონტი"] }, { label: "სახლის სრული რემონტი", searchTerms: ["სახლის რემონტი"] }, { label: "ნაწილობრივი რემონტი" }, { label: "აბაზანის რემონტი" }, { label: "სამზარეულოს რემონტი" }, { label: "სარემონტო ბრიგადა", searchTerms: ["ბრიგადა", "ხელოსნების ბრიგადა"] }, { label: "სხვა" },
  ] },
  { id: "construction", label: "მშენებლობა", icon: "⌂", image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=480&auto=format&fit=crop", legacyProfessions: ["ბეტონის სამუშაოები", "დემონტაჟი", "სამუშაოთა ხელმძღვანელი"], subcategories: [
    { label: "სახლის აშენება", searchTerms: ["სახლი მინდა ავაშენო", "მშენებლობა"] }, { label: "მიშენება/დაშენება", searchTerms: ["მიშენება", "დაშენება"] }, { label: "საძირკველი" }, { label: "ბეტონის სამუშაოები", searchTerms: ["ბეტონი"] }, { label: "აგურისა და ბლოკის წყობა", searchTerms: ["აგური", "ბლოკი", "წყობა"] }, { label: "დემონტაჟი" }, { label: "სამუშაოთა ხელმძღვანელი (პრარაბი / ბრიგადირი)", searchTerms: ["პრარაბი", "ბრიგადირი", "სამუშაოთა ხელმძღვანელი", "რემონტის ხელმძღვანელი", "ბრიგადა", "ხელოსნების ბრიგადა"] }, { label: "სხვა" },
  ] },
  { id: "roof-insulation", label: "სახურავი და იზოლაცია", icon: "⌂", image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=480&auto=format&fit=crop", legacyProfessions: ["სახურავი", "იზოლაცია"], subcategories: [
    { label: "სახურავის მოწყობა" }, { label: "სახურავის შეკეთება" }, { label: "გადახურვის შეცვლა" }, { label: "სახურავის გაჟონვა", searchTerms: ["გაჟონვა", "სახურავი ჟონავს"] }, { label: "ღარები" }, { label: "ჰიდროიზოლაცია" }, { label: "თბო/ხმის იზოლაცია", searchTerms: ["თბოიზოლაცია", "ხმის იზოლაცია", "იზოლაცია"] }, { label: "სხვა" },
  ] },
  { id: "heating-air", label: "გათბობა და კონდიცირება", icon: "≋", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=480&auto=format&fit=crop", legacyProfessions: ["გათბობა-გაგრილება"], subcategories: [
    { label: "კონდიციონერის მონტაჟი", searchTerms: ["კონდიციონერი", "კონდ"] }, { label: "კონდიციონერის შეკეთება", searchTerms: ["კონდიციონერის შეკეთება"] }, { label: "გათბობის სისტემა" }, { label: "ქვაბის მონტაჟი/შეკეთება", searchTerms: ["ქვაბი"] }, { label: "რადიატორი" }, { label: "თბილი იატაკი" }, { label: "ვენტილაცია" }, { label: "სხვა" },
  ] },
  { id: "drywall-ceiling", label: "გიფსოკარდონი და ჭერი", icon: "▦", image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=480&auto=format&fit=crop", legacyProfessions: ["გიფსოკარდონი", "ჭერის ხელოსანი"], subcategories: [
    { label: "გიფსოკარდონი" }, { label: "ტიხარი" }, { label: "შეკიდული ჭერი" }, { label: "ჭერის შეკეთება" }, { label: "დეკორატიული ჭერი" }, { label: "სხვა" },
  ] },
  { id: "tile-floor", label: "კაფელი და იატაკი", icon: "▰", image: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=480&auto=format&fit=crop", legacyProfessions: ["კაფელები", "იატაკის დაგება", "ხის იატაკი"], subcategories: [
    { label: "კაფელი/მეტლახი", searchTerms: ["კაფელი", "მეტლახი", "ფილა", "ფილები", "კერამიკა"] }, { label: "ლამინატი", searchTerms: ["ლამ"] }, { label: "პარკეტი" }, { label: "ვინილის იატაკი", searchTerms: ["ვინილი"] }, { label: "ხის იატაკი" }, { label: "იატაკის გასწორება" }, { label: "პლინტუსი" }, { label: "სხვა" },
  ] },
  { id: "doors-windows-glass", label: "კარი, ფანჯარა და მინა", icon: "▧", image: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=480&auto=format&fit=crop", legacyProfessions: ["ალუმინის კარ-ფანჯარა", "კარ-ფანჯრის მონტაჟი", "მინების ხელოსანი"], subcategories: [
    { label: "ალუმინის კარ-ფანჯარა" }, { label: "PVC კარ-ფანჯარა", searchTerms: ["პვც", "პლასტმასის კარ ფანჯარა"] }, { label: "კარის მონტაჟი/შეკეთება" }, { label: "მინის შეცვლა" }, { label: "ჟალუზი" }, { label: "მწერების ბადე" }, { label: "სხვა" },
  ] },
  { id: "metal", label: "ლითონის სამუშაოები", icon: "△", image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=480&auto=format&fit=crop", legacyProfessions: ["მეტალის კონსტრუქციები"], subcategories: [
    { label: "შედუღება" }, { label: "მეტალის კონსტრუქცია" }, { label: "კიბე" }, { label: "მოაჯირი" }, { label: "ჭიშკარი" }, { label: "ღობე" }, { label: "სხვა" },
  ] },
  { id: "furniture-wood", label: "ავეჯი და ხის სამუშაოები", icon: "▤", image: "https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=480&auto=format&fit=crop", legacyProfessions: ["ავეჯის ხელოსანი", "დურგალი"], subcategories: [
    { label: "ავეჯის დამზადება" }, { label: "ავეჯის აწყობა/შეკეთება" }, { label: "სამზარეულოს ავეჯი" }, { label: "კარადა" }, { label: "დურგლის სამუშაო" }, { label: "ხის დეკორი" }, { label: "სხვა" },
  ] },
  { id: "design", label: "დიზაინი და დაგეგმვა", icon: "◱", image: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=480&auto=format&fit=crop", legacyProfessions: ["დიზაინერი"], subcategories: [
    { label: "ინტერიერის დიზაინი" }, { label: "3D ვიზუალიზაცია" }, { label: "აზომვა" }, { label: "სარემონტო კონსულტაცია" }, { label: "მასალების შერჩევა" }, { label: "სხვა" },
  ] },
  { id: "yard-exterior", label: "ეზო და გარე სამუშაოები", icon: "▥", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=480&auto=format&fit=crop", subcategories: [
    { label: "ბრუსჩატკა/ქვაფენილი", searchTerms: ["ბრუსჩატკა", "ქვაფენილი"] }, { label: "ეზოს ბეტონი" }, { label: "ქვის მოპირკეთება" }, { label: "ფასადის მოპირკეთება" }, { label: "ღობე და ჭიშკარი" }, { label: "ტერასა" }, { label: "სხვა" },
  ] },
].map((category) => ({ ...category, professions: [...category.subcategories.map((item) => item.label), allForCategory(category.label)] }));

export const SUPERVISOR_CAPABILITIES = [
  "მხოლოდ სამუშაოთა ხელმძღვანელობა",
  "ხელმძღვანელობა საკუთარი ბრიგადით",
  "ბინის/სახლის სრული რემონტი",
  "სახლის აშენება",
] as const;

export const categories = ["all", ...categoryGroups.map((category) => category.id)] as const;
export const allServiceProfessionOptions = categoryGroups.reduce<string[]>(
  (items, category) => items.concat(category.subcategories.map((item) => item.label)),
  []
);
export const categoryLabels: Record<string, string> = categoryGroups.reduce<Record<string, string>>(
  (labels, category) => {
    labels[category.id] = category.label;
    category.subcategories.forEach((item) => { labels[item.label] = item.label; });
    return labels;
  },
  { all: "ყველა" }
);
export const categoryIcons: Record<string, string> = categoryGroups.reduce<Record<string, string>>(
  (icons, category) => { icons[category.id] = category.icon; return icons; },
  { all: "⌘" }
);
export const categoryImages: Record<string, string> = categoryGroups.reduce<Record<string, string>>(
  (images, category) => { images[category.id] = category.image; return images; },
  { all: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=240&auto=format&fit=crop" }
);

const normalizeSearch = (value: string) => value.toLocaleLowerCase("ka-GE").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const findCategoryForValue = (value: string) => {
  const normalized = normalizeSearch(value);
  return categoryGroups.find((category) =>
    normalizeSearch(category.id) === normalized ||
    normalizeSearch(category.label) === normalized ||
    category.legacyProfessions?.some((item) => normalizeSearch(item) === normalized) ||
    category.subcategories.some((item) => normalizeSearch(item.label) === normalized) ||
    normalizeSearch(allForCategory(category.label)) === normalized
  );
};

export const getCategoryGroupForProfession = (profession: string) => findCategoryForValue(profession);
export const getCategoryById = (id: string) => categoryGroups.find((category) => category.id === id);
export const getCategoryForProfession = (profession: string) => findCategoryForValue(profession);
export const getAllProfessionValue = (category: CategoryGroup) => allForCategory(category.label);
export const makeServiceSelection = (categoryId: string, subcategory: string) => `${categoryId}::${subcategory}`;
const parseServiceSelection = (value: string) => {
  const [categoryId, ...parts] = value.split("::");
  const category = getCategoryById(categoryId);
  return category && parts.length ? { category, subcategory: parts.join("::") } : null;
};
export const getServiceSelectionLabel = (value: string) => parseServiceSelection(value)?.subcategory || value;

export const workerMatchesService = (workerValues: readonly string[], selection: string) => {
  if (selection === "all") return true;
  const parsedSelection = parseServiceSelection(selection);
  const targetCategory = parsedSelection?.category || findCategoryForValue(selection);
  if (!targetCategory) return workerValues.some((value) => normalizeSearch(value) === normalizeSearch(selection));
  const selectionIsCategory = targetCategory.id === selection || Boolean(
    !parsedSelection && targetCategory.legacyProfessions?.some((legacy) => normalizeSearch(legacy) === normalizeSearch(selection))
  );
  return workerValues.some((value) => {
    const normalizedValue = normalizeSearch(value);
    const parsedValue = parseServiceSelection(value);
    if (
      parsedSelection?.category.id === "full-renovation" &&
      parsedSelection.subcategory === "ბინის სრული რემონტი" &&
      normalizedValue === normalizeSearch("ბინის/სახლის სრული რემონტი")
    ) return true;
    if (parsedValue?.category.id === targetCategory.id) {
      return selectionIsCategory || parsedValue.subcategory === parsedSelection?.subcategory;
    }
    if (normalizedValue === normalizeSearch(getAllProfessionValue(targetCategory))) return true;
    if (normalizedValue === normalizeSearch(parsedSelection?.subcategory || selection)) return true;
    const valueCategory = findCategoryForValue(value);
    if (!valueCategory || valueCategory.id !== targetCategory.id) return false;
    return selectionIsCategory || Boolean(targetCategory.legacyProfessions?.some((legacy) => normalizeSearch(legacy) === normalizedValue));
  });
};

export interface SearchSuggestion { categoryId: string; categoryLabel: string; subcategory: string; }
const matchesSearchTerm = (term: string, query: string) => {
  const normalizedTerm = normalizeSearch(term);
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return false;
  if (normalizedTerm.includes(normalizedQuery) || normalizedQuery.includes(normalizedTerm)) return true;
  return normalizedQuery.split(" ").filter((token) => token.length >= 3).some((token) => normalizedTerm.includes(token));
};
export const getSearchSuggestions = (query: string): SearchSuggestion[] => categoryGroups.reduce<Array<{ categoryId: string; categoryLabel: string; subcategory: ServiceSubcategory; terms: readonly string[] }>>(
  (items, category) => items.concat(category.subcategories.map((subcategory) => ({ categoryId: category.id, categoryLabel: category.label, subcategory, terms: [category.label, subcategory.label].concat(subcategory.searchTerms || []) }))),
  []
).filter((item) => item.terms.some((term) => matchesSearchTerm(term, query)))
  .map(({ categoryId, categoryLabel, subcategory }) => ({ categoryId, categoryLabel, subcategory: subcategory.label }))
  .slice(0, 6);

export const georgiaCities = [
  "თბილისი",
  "აბაშა",
  "ადიგენი",
  "ამბროლაური",
  "ახალგორი",
  "ახალქალაქი",
  "ახალციხე",
  "ახმეტა",
  "ბათუმი",
  "ბაღდათი",
  "ბოლნისი",
  "ბორჯომი",
  "გარდაბანი",
  "გორი",
  "გურჯაანი",
  "დედოფლისწყარო",
  "დმანისი",
  "დუშეთი",
  "ვანი",
  "ზესტაფონი",
  "ზუგდიდი",
  "თელავი",
  "თეთრიწყარო",
  "თიანეთი",
  "კასპი",
  "ლაგოდეხი",
  "ლანჩხუთი",
  "ლენტეხი",
  "მარნეული",
  "მარტვილი",
  "მესტია",
  "მცხეთა",
  "ნინოწმინდა",
  "ოზურგეთი",
  "ონი",
  "რუსთავი",
  "საგარეჯო",
  "სამტრედია",
  "საჩხერე",
  "სენაკი",
  "სიღნაღი",
  "სტეფანწმინდა",
  "ფოთი",
  "ქარელი",
  "ქობულეთი",
  "ქუთაისი",
  "ყვარელი",
  "შუახევი",
  "ჩოხატაური",
  "ჩხოროწყუ",
  "ცაგერი",
  "წალენჯიხა",
  "წალკა",
  "წყალტუბო",
  "ჭიათურა",
  "ხარაგაული",
  "ხაშური",
  "ხობი",
  "ხონი",
] as const;
