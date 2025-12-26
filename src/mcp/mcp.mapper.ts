export type ProductSearchItem = {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  currency: string | null;
  store: string | null;
  url: string | null;
  image_url: string | null;
  nutrition: {
    kcal100: number | null;
    protein100: number | null;
    fat100: number | null;
    carbs100: number | null;
  };
};

export type ProductSearchResult = {
  count: number;
  items: ProductSearchItem[];
};

type ProductLike = {
  id: string;
  name: string;
  brand: string | null;
  kcal100: number | null;
  protein100: number | null;
  fat100: number | null;
  carbs100: number | null;
};

export function formatSearchResult(products: ProductLike[]): ProductSearchResult {
  return {
    count: products.length,
    items: products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: null,
      currency: null,
      store: null,
      url: null,
      image_url: null,
      nutrition: {
        kcal100: product.kcal100,
        protein100: product.protein100,
        fat100: product.fat100,
        carbs100: product.carbs100,
      },
    })),
  };
}
