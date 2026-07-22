-- CreateEnum
CREATE TYPE "HotelDepartment" AS ENUM ('FRONT_OFFICE', 'REVENUE_MANAGEMENT', 'SALES', 'FINANCE', 'HOUSEKEEPING', 'MAINTENANCE', 'GENERAL_MANAGER', 'CORPORATE_OFFICE');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "OpportunityValue" AS ENUM ('QUICK_WIN', 'HIGH_ROI', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "DecisionWindow" AS ENUM ('IMMEDIATE', 'HOURS_72', 'WEEK', 'MONTH');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "department" "HotelDepartment";

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "decisionWindow" "DecisionWindow",
ADD COLUMN     "department" "HotelDepartment",
ADD COLUMN     "opportunityValue" "OpportunityValue",
ADD COLUMN     "severity" "RiskSeverity";
