-- DropForeignKey + DropTable: the lot↔subcategory join is replaced by linking
-- the lot to a single Item, which already carries its subcategory and category.
DROP TABLE IF EXISTS "lot_subcategories" CASCADE;
