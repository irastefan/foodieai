-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "nutritionPerServing" JSONB,
ADD COLUMN     "nutritionTotal" JSONB;

-- AlterTable
ALTER TABLE "RecipeDraft" ADD COLUMN     "nutritionPerServing" JSONB,
ADD COLUMN     "nutritionTotal" JSONB;

-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "nutritionPerServing" JSONB,
ADD COLUMN     "nutritionTotal" JSONB;
