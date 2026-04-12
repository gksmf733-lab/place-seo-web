export type MenuItem = {
  name: string;
  price: string;
  description?: string;
};

export type ScrapedPlace = {
  placeId: string;
  inputUrl: string;
  scrapedUrl: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  hours: string;
  homepage: string;
  amenities: string;
  rating: string;
  visitorReviews: string;
  blogReviews: string;
  description: string;
  menuItems: string[];
  menuItemsV2?: MenuItem[];
  rawText: string;
  errors: string[];
};
