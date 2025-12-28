export class RecipeNotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
  }
}

export class RecipeDraftNotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
  }
}

export class DraftIncompleteError extends Error {
  readonly missingFields: string[];
  readonly missingIngredients: Array<{
    ingredientId: string;
    name: string;
    missing: string[];
    hint: string;
  }>;

  constructor(options: {
    missingFields: string[];
    missingIngredients: Array<{
      ingredientId: string;
      name: string;
      missing: string[];
      hint: string;
    }>;
  }) {
    super("DRAFT_INCOMPLETE");
    this.missingFields = options.missingFields;
    this.missingIngredients = options.missingIngredients;
  }
}
