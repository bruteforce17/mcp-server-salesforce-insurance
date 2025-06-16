import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Import the Insurance Policy Design Tool (assuming it's in a separate file)
import { 
  InsurancePolicyDesignTool, 
  InsurancePolicyDesignRequest,
  handleInsurancePolicyDesign 
} from "./insurance-policy-design-tool.js";

/**
 * Tool registration for Insurance Policy Design
 */
export const insurancePolicyDesignTool:Tool = {
  name: "insurance_policy_design",
  description: "Design and manage InsurancePolicy entities using Salesforce Product Catalog Management Business APIs. Supports creating comprehensive insurance policies with coverage options, pricing models, eligibility criteria, and custom fields.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["design", "list", "clone"],
        description: "Operation to perform: 'design' creates new policy, 'list' retrieves existing policies, 'clone' duplicates existing policy"
      },
      request: {
        type: "object",
        description: "Insurance policy design request (required for 'design' operation)",
        properties: {
          policyName: {
            type: "string",
            description: "Name of the insurance policy"
          },
          policyType: {
            type: "string",
            enum: ["AUTO", "HOME", "LIFE", "HEALTH", "COMMERCIAL", "UMBRELLA"],
            description: "Type of insurance policy"
          },
          productCatalogId: {
            type: "string",
            description: "Optional existing Product Catalog ID to update"
          },
          coverageOptions: {
            type: "array",
            description: "Array of coverage options for the policy",
            items: {
              type: "object",
              properties: {
                coverageType: { type: "string", description: "Type of coverage" },
                coverageLimit: { type: "number", description: "Maximum coverage amount" },
                deductible: { type: "number", description: "Deductible amount" },
                premium: { type: "number", description: "Premium cost for this coverage" },
                isOptional: { type: "boolean", description: "Whether coverage is optional" },
                description: { type: "string", description: "Coverage description" }
              },
              required: ["coverageType", "coverageLimit", "deductible", "premium", "isOptional"]
            }
          },
          pricingModel: {
            type: "object",
            description: "Pricing model configuration",
            properties: {
              basePremium: { type: "number", description: "Base premium amount" },
              calculationMethod: {
                type: "string",
                enum: ["FLAT_RATE", "FACTOR_BASED", "TIER_BASED", "USAGE_BASED"],
                description: "Method for calculating premiums"
              },
              pricingFactors: {
                type: "array",
                description: "Factors that affect pricing",
                items: {
                  type: "object",
                  properties: {
                    factorName: { type: "string", description: "Name of the pricing factor" },
                    factorType: {
                      type: "string",
                      enum: ["AGE", "LOCATION", "CREDIT_SCORE", "DRIVING_RECORD", "CLAIM_HISTORY", "CUSTOM"],
                      description: "Type of pricing factor"
                    },
                    multiplier: { type: "number", description: "Multiplier value for the factor" },
                    isRequired: { type: "boolean", description: "Whether factor is required" }
                  },
                  required: ["factorName", "factorType", "multiplier", "isRequired"]
                }
              },
              discounts: {
                type: "array",
                description: "Available discounts",
                items: {
                  type: "object",
                  properties: {
                    discountName: { type: "string", description: "Name of the discount" },
                    discountType: {
                      type: "string",
                      enum: ["PERCENTAGE", "FIXED_AMOUNT"],
                      description: "Type of discount"
                    },
                    discountValue: { type: "number", description: "Discount value" },
                    eligibilityConditions: {
                      type: "array",
                      items: { type: "string" },
                      description: "Conditions for discount eligibility"
                    }
                  },
                  required: ["discountName", "discountType", "discountValue", "eligibilityConditions"]
                }
              }
            },
            required: ["basePremium", "calculationMethod", "pricingFactors", "discounts"]
          },
          eligibilityCriteria: {
            type: "object",
            description: "Criteria for policy eligibility",
            properties: {
              minimumAge: { type: "number", description: "Minimum age requirement" },
              maximumAge: { type: "number", description: "Maximum age requirement" },
              geographicRestrictions: {
                type: "array",
                items: { type: "string" },
                description: "Geographic restrictions"
              },
              creditScoreRequirement: { type: "number", description: "Minimum credit score" },
              industryRestrictions: {
                type: "array",
                items: { type: "string" },
                description: "Industry restrictions"
              },
              customCriteria: {
                type: "object",
                description: "Custom eligibility criteria"
              }
            }
          },
          policyTerms: {
            type: "object",
            description: "Policy terms and conditions",
            properties: {
              termLength: { type: "number", description: "Term length in months" },
              renewalType: {
                type: "string",
                enum: ["AUTOMATIC", "MANUAL"],
                description: "Type of renewal"
              },
              cancellationPolicy: { type: "string", description: "Cancellation policy details" },
              paymentFrequency: {
                type: "string",
                enum: ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"],
                description: "Payment frequency"
              },
              gracePeriod: { type: "number", description: "Grace period in days" }
            },
            required: ["termLength", "renewalType", "cancellationPolicy", "paymentFrequency", "gracePeriod"]
          },
          customFields: {
            type: "array",
            description: "Custom fields to create",
            items: {
              type: "object",
              properties: {
                fieldName: { type: "string", description: "Name of the custom field" },
                fieldType: {
                  type: "string",
                  enum: ["TEXT", "NUMBER", "DATE", "PICKLIST", "CHECKBOX", "CURRENCY"],
                  description: "Type of custom field"
                },
                isRequired: { type: "boolean", description: "Whether field is required" },
                picklistValues: {
                  type: "array",
                  items: { type: "string" },
                  description: "Values for picklist fields"
                },
                defaultValue: { description: "Default value for the field" },
                fieldDescription: { type: "string", description: "Field description" }
              },
              required: ["fieldName", "fieldType", "isRequired"]
            }
          }
        }
      },
      policyType: {
        type: "string",
        enum: ["AUTO", "HOME", "LIFE", "HEALTH", "COMMERCIAL", "UMBRELLA"],
        description: "Filter by policy type (for 'list' operation)"
      },
      limit: {
        type: "number",
        description: "Maximum number of records to return (for 'list' operation)",
        default: 50
      },
      sourcePolicyId: {
        type: "string",
        description: "ID of the policy to clone (required for 'clone' operation)"
      },
      newPolicyName: {
        type: "string",
        description: "Name for the cloned policy (required for 'clone' operation)"
      },
      modifications: {
        type: "object",
        description: "Modifications to apply to cloned policy (optional for 'clone' operation)"
      }
    },
    required: ["operation"]
  }
};

/**
 * Handle insurance policy design tool calls
 */
export async function handleInsurancePolicyDesignTool(
  connection: any,
  args: any
): Promise<any> {
  try {
    // Validate required parameters based on operation
    switch (args.operation) {
      case "design":
        if (!args.request) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Request parameter is required for design operation"
          );
        }
        break;
      case "clone":
        if (!args.sourcePolicyId || !args.newPolicyName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "sourcePolicyId and newPolicyName are required for clone operation"
          );
        }
        break;
      case "list":
        // No additional validation needed
        break;
      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unsupported operation: ${args.operation}`
        );
    }

    // Call the insurance policy design handler
    return await handleInsurancePolicyDesign(connection, args);

  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Insurance Policy Design Tool error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}