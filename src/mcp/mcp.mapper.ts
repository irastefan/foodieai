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

export type UserMeProfile = {
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goal: string | null;
  calorieDelta: number | null;
};

export type UserMeTargets = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

export type UserMeResult = {
  profile: UserMeProfile;
  targets: UserMeTargets;
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

type ProfileLike = {
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goal: string | null;
  calorieDelta: number | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetFatG: number | null;
  targetCarbsG: number | null;
};

export function formatUserMe(profile: ProfileLike | null): UserMeResult {
  return {
    profile: {
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      sex: profile?.sex ?? null,
      birthDate: profile?.birthDate
        ? profile.birthDate.toISOString().slice(0, 10)
        : null,
      heightCm: profile?.heightCm ?? null,
      weightKg: profile?.weightKg ?? null,
      activityLevel: profile?.activityLevel ?? null,
      goal: profile?.goal ?? null,
      calorieDelta: profile?.calorieDelta ?? null,
    },
    targets: {
      kcal: profile?.targetCalories ?? null,
      protein: profile?.targetProteinG ?? null,
      fat: profile?.targetFatG ?? null,
      carbs: profile?.targetCarbsG ?? null,
    },
  };
}
