-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "nameEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ingredient" ADD COLUMN "aliasesVi" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Ingredient" ADD COLUMN "aliasesEn" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropColumn
ALTER TABLE "Ingredient" DROP COLUMN "aliases";
