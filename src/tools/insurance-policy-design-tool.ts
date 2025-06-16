import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Insurance Policy Entity Design Tool - Using Salesforce Standard Objects
 * 
 * This tool provides functionality to design and manage InsurancePolicy entities
 * using Salesforce Financial Services Cloud standard objects.
 */

export interface InsurancePolicyDesignRequest {
  policyName: string;
  policyType: 'Auto' | 'Home' | 'Life' | 'Health' | 'Commercial' | 'Umbrella';
  productId?: string; // Links to Product2
  accountId: string; // Policy holder account
  coverageOptions: CoverageOption[];
  pricingModel: PricingModel;
  policyTerms: PolicyTerms;
  participants?: PolicyParticipant[];
}

export interface CoverageOption {
  coverageType: string;
  coverageAmount: number;
  deductibleAmount?: number;
  premium: number;
  isOptional: boolean;
  coverageDescription: string;
}

export interface PricingModel {
  totalPremiumAmount: number;
  premiumFrequency: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual';
  premiumCalculationMethod: 'Fixed' | 'Calculated' | 'Usage-Based';
}

export interface PolicyTerms {
  termStartDate: string; // ISO date string
  termEndDate: string; // ISO date string
  termType: 'Annual' | 'Semi-Annual' | 'Short-Term';
  renewalChannel: 'Automatic' | 'Manual';
  cancellationProcessType: string;
  gracePeriodDays?: number;
}

export interface PolicyParticipant {
  contactId: string; // Links to Contact
  role: 'Primary Insured' | 'Secondary Insured' | 'Beneficiary' | 'Dependent';
  relationshipToInsured?: string;
  isActive: boolean;
}

export class InsurancePolicyDesignTool {
  private connection: any;
  
  // Standard Object API Names
  private readonly INSURANCE_POLICY_OBJECT = 'InsurancePolicy';
  private readonly INSURANCE_POLICY_COVERAGE_OBJECT = 'InsurancePolicyCoverage';
  private readonly INSURANCE_POLICY_PARTICIPANT_OBJECT = 'InsurancePolicyParticipant';
  private readonly INSURANCE_POLICY_ASSET_OBJECT = 'InsurancePolicyAsset';
  private readonly PRODUCT_OBJECT = 'Product2';
  private readonly PRICEBOOK_ENTRY_OBJECT = 'PricebookEntry';
  private readonly ACCOUNT_OBJECT = 'Account';
  private readonly CONTACT_OBJECT = 'Contact';

  constructor(connection: any) {
    this.connection = connection;
  }

  /**
   * Design a new InsurancePolicy entity using standard objects
   */
  async designInsurancePolicyEntity(request: InsurancePolicyDesignRequest): Promise<any> {
    try {
      // Step 1: Validate the request
      await this.validateDesignRequest(request);

      // Step 2: Create or get the Product2 record
      const product = await this.handleProductRecord(request);

      // Step 3: Create the main InsurancePolicy record
      const insurancePolicyRecord = await this.createInsurancePolicyRecord(request, product.Id);

      // Step 4: Create coverage records
      const coverageRecords = await this.createPolicyCoverages(request, insurancePolicyRecord.Id);

      // Step 5: Create policy participants if specified
      const participantRecords = await this.createPolicyParticipants(request, insurancePolicyRecord.Id);

      // Step 6: Create pricebook entry for pricing
      const pricebookEntry = await this.createPricebookEntry(product.Id, request.pricingModel);

      // Step 7: Generate configuration summary
      const configurationSummary = this.generateConfigurationSummary(
        request,
        insurancePolicyRecord,
        product,
        coverageRecords,
        participantRecords,
        pricebookEntry
      );

      return {
        success: true,
        message: 'Insurance Policy entity designed successfully using standard objects',
        data: {
          insurancePolicyId: insurancePolicyRecord.Id,
          productId: product.Id,
          coverageCount: coverageRecords.length,
          participantCount: participantRecords.length,
          configurationSummary,
          metadata: {
            createdDate: new Date().toISOString(),
            policyType: request.policyType,
            standardObjectsUsed: [
              this.INSURANCE_POLICY_OBJECT,
              this.INSURANCE_POLICY_COVERAGE_OBJECT,
              this.INSURANCE_POLICY_PARTICIPANT_OBJECT,
              this.PRODUCT_OBJECT,
              this.PRICEBOOK_ENTRY_OBJECT
            ]
          }
        }
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to design Insurance Policy entity: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle Product2 record creation or retrieval
   */
  private async handleProductRecord(request: InsurancePolicyDesignRequest): Promise<any> {
    if (request.productId) {
      // Retrieve existing product
      const existingProduct = await this.connection.sobject(this.PRODUCT_OBJECT)
        .findOne({ Id: request.productId });
      
      if (!existingProduct) {
        throw new Error(`Product with ID ${request.productId} not found`);
      }
      return existingProduct;
    } else {
      // Create new product
      const productData = {
        Name: request.policyName,
        ProductCode: `INS_${request.policyType.toUpperCase()}_${Date.now()}`,
        Description: `Insurance Product: ${request.policyName} (${request.policyType})`,
        Family: 'Insurance',
        IsActive: true
      };

      const createResult = await this.connection.sobject(this.PRODUCT_OBJECT)
        .create(productData);
      
      if (createResult.success) {
        return { Id: createResult.id, ...productData };
      } else {
        throw new Error(`Failed to create Product record: ${createResult.errors?.join(', ')}`);
      }
    }
  }

  /**
   * Create the main InsurancePolicy record
   */
  private async createInsurancePolicyRecord(
    request: InsurancePolicyDesignRequest, 
    productId: string
  ): Promise<any> {
    const policyData = {
      Name: request.policyName,
      PolicyType: request.policyType,
      NameInsuredId: request.accountId, // Primary insured account
      ProductId: productId, // Link to Product2
      Status: 'In Force', // Standard picklist value
      TotalPremiumAmount: request.pricingModel.totalPremiumAmount,
      PremiumFrequency: request.pricingModel.premiumFrequency,
      PremiumCalculationMethod: request.pricingModel.premiumCalculationMethod,
      TermStartDate: request.policyTerms.termStartDate,
      TermEndDate: request.policyTerms.termEndDate,
      TermType: request.policyTerms.termType,
      RenewalChannel: request.policyTerms.renewalChannel,
      CancellationProcessType: request.policyTerms.cancellationProcessType,
      GracePeriodDays: request.policyTerms.gracePeriodDays || 30
    };

    const createResult = await this.connection.sobject(this.INSURANCE_POLICY_OBJECT)
      .create(policyData);
    
    if (createResult.success) {
      return { Id: createResult.id, ...policyData };
    } else {
      throw new Error(`Failed to create InsurancePolicy record: ${createResult.errors?.join(', ')}`);
    }
  }

  /**
   * Create InsurancePolicyCoverage records
   */
  private async createPolicyCoverages(
    request: InsurancePolicyDesignRequest,
    insurancePolicyId: string
  ): Promise<any[]> {
    const coverageRecords = [];

    for (const coverage of request.coverageOptions) {
      const coverageData = {
        Name: `${coverage.coverageType} Coverage`,
        InsurancePolicyId: insurancePolicyId,
        CoverageType: coverage.coverageType,
        CoverageAmount: coverage.coverageAmount,
        DeductibleAmount: coverage.deductibleAmount || 0,
        Premium: coverage.premium,
        IsOptionalCoverage: coverage.isOptional,
        CoverageDescription: coverage.coverageDescription,
        EffectiveDate: request.policyTerms.termStartDate,
        ExpirationDate: request.policyTerms.termEndDate
      };

      try {
        const coverageResult = await this.connection.sobject(this.INSURANCE_POLICY_COVERAGE_OBJECT)
          .create(coverageData);
        
        if (coverageResult.success) {
          coverageRecords.push({ Id: coverageResult.id, ...coverageData });
        }
      } catch (error) {
        console.warn(`Failed to create coverage ${coverage.coverageType}:`, error);
      }
    }

    return coverageRecords;
  }

  /**
   * Create InsurancePolicyParticipant records
   */
  private async createPolicyParticipants(
    request: InsurancePolicyDesignRequest,
    insurancePolicyId: string
  ): Promise<any[]> {
    const participantRecords = [];

    if (!request.participants || request.participants.length === 0) {
      return [];
    }

    for (const participant of request.participants) {
      const participantData = {
        InsurancePolicyId: insurancePolicyId,
        PrimaryParticipantContactId: participant.contactId,
        Role: participant.role,
        RelationshipToInsured: participant.relationshipToInsured,
        IsActiveParticipant: participant.isActive
      };

      try {
        const participantResult = await this.connection.sobject(this.INSURANCE_POLICY_PARTICIPANT_OBJECT)
          .create(participantData);
        
        if (participantResult.success) {
          participantRecords.push({ Id: participantResult.id, ...participantData });
        }
      } catch (error) {
        console.warn(`Failed to create participant with contact ID ${participant.contactId}:`, error);
      }
    }

    return participantRecords;
  }

  /**
   * Create PricebookEntry for the product
   */
  private async createPricebookEntry(productId: string, pricingModel: PricingModel): Promise<any> {
    try {
      // Get standard pricebook
      const standardPricebook = await this.connection.query(
        "SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1"
      );

      if (!standardPricebook.records || standardPricebook.records.length === 0) {
        throw new Error('Standard Pricebook not found');
      }

      const pricebookEntryData = {
        Product2Id: productId,
        Pricebook2Id: standardPricebook.records[0].Id,
        UnitPrice: pricingModel.totalPremiumAmount,
        IsActive: true,
        UseStandardPrice: false
      };

      const createResult = await this.connection.sobject(this.PRICEBOOK_ENTRY_OBJECT)
        .create(pricebookEntryData);
      
      if (createResult.success) {
        return { Id: createResult.id, ...pricebookEntryData };
      } else {
        console.warn(`Failed to create PricebookEntry: ${createResult.errors?.join(', ')}`);
        return null;
      }
    } catch (error) {
      console.warn('Failed to create PricebookEntry:', error);
      return null;
    }
  }

  /**
   * Validate the design request
   */
  private async validateDesignRequest(request: InsurancePolicyDesignRequest): Promise<void> {
    if (!request.policyName || request.policyName.trim() === '') {
      throw new Error('Policy name is required');
    }

    if (!request.policyType) {
      throw new Error('Policy type is required');
    }

    if (!request.accountId) {
      throw new Error('Account ID is required for the policy holder');
    }

    // Validate account exists
    const account = await this.connection.sobject(this.ACCOUNT_OBJECT)
      .findOne({ Id: request.accountId });
    
    if (!account) {
      throw new Error(`Account with ID ${request.accountId} not found`);
    }

    if (!request.coverageOptions || request.coverageOptions.length === 0) {
      throw new Error('At least one coverage option is required');
    }

    if (!request.pricingModel || !request.pricingModel.totalPremiumAmount) {
      throw new Error('Pricing model with total premium amount is required');
    }

    if (!request.policyTerms || !request.policyTerms.termStartDate || !request.policyTerms.termEndDate) {
      throw new Error('Policy terms with start and end dates are required');
    }

    // Validate date format
    const startDate = new Date(request.policyTerms.termStartDate);
    const endDate = new Date(request.policyTerms.termEndDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format in policy terms');
    }

    if (startDate >= endDate) {
      throw new Error('Term start date must be before term end date');
    }

    // Validate participants if provided
    if (request.participants) {
      for (const participant of request.participants) {
        const contact = await this.connection.sobject(this.CONTACT_OBJECT)
          .findOne({ Id: participant.contactId });
        
        if (!contact) {
          throw new Error(`Contact with ID ${participant.contactId} not found`);
        }
      }
    }
  }

  /**
   * Generate a comprehensive configuration summary
   */
  private generateConfigurationSummary(
    request: InsurancePolicyDesignRequest,
    insurancePolicyRecord: any,
    product: any,
    coverageRecords: any[],
    participantRecords: any[],
    pricebookEntry: any
  ): any {
    return {
      policyOverview: {
        id: insurancePolicyRecord.Id,
        name: request.policyName,
        type: request.policyType,
        status: insurancePolicyRecord.Status,
        totalPremium: request.pricingModel.totalPremiumAmount,
        premiumFrequency: request.pricingModel.premiumFrequency,
        termStart: request.policyTerms.termStartDate,
        termEnd: request.policyTerms.termEndDate
      },
      productInformation: {
        id: product.Id,
        name: product.Name,
        productCode: product.ProductCode,
        family: product.Family,
        isActive: product.IsActive
      },
      coverageConfiguration: {
        totalCoverageOptions: coverageRecords.length,
        coverageTypes: coverageRecords.map(c => c.CoverageType),
        totalCoverageAmount: coverageRecords.reduce((total, c) => total + (c.CoverageAmount || 0), 0),
        totalPremiumFromCoverages: coverageRecords.reduce((total, c) => total + (c.Premium || 0), 0),
        optionalCoverages: coverageRecords.filter(c => c.IsOptionalCoverage).length
      },
      participantConfiguration: {
        totalParticipants: participantRecords.length,
        activeParticipants: participantRecords.filter(p => p.IsActiveParticipant).length,
        participantRoles: [...new Set(participantRecords.map(p => p.Role))]
      },
      pricingConfiguration: {
        hasPricebookEntry: !!pricebookEntry,
        calculationMethod: request.pricingModel.premiumCalculationMethod,
        frequency: request.pricingModel.premiumFrequency
      },
      compliance: {
        dataModel: 'Salesforce Financial Services Cloud - Standard Objects',
        objectsUsed: [
          this.INSURANCE_POLICY_OBJECT,
          this.INSURANCE_POLICY_COVERAGE_OBJECT,
          this.INSURANCE_POLICY_PARTICIPANT_OBJECT,
          this.PRODUCT_OBJECT,
          this.PRICEBOOK_ENTRY_OBJECT
        ],
        standardCompliant: true
      }
    };
  }

  /**
   * Get existing insurance policies
   */
  async getExistingPolicies(policyType?: string, limit: number = 50): Promise<any> {
    try {
      let query = `
        SELECT Id, Name, PolicyType, Status, TotalPremiumAmount, 
               PremiumFrequency, TermStartDate, TermEndDate,
               NameInsuredId, NameInsured.Name, ProductId, Product.Name,
               CreatedDate, LastModifiedDate
        FROM ${this.INSURANCE_POLICY_OBJECT}
        WHERE Status IN ('In Force', 'Pending', 'Suspended')
      `;

      if (policyType) {
        query += ` AND PolicyType = '${policyType}'`;
      }

      query += ` ORDER BY CreatedDate DESC LIMIT ${limit}`;

      const result = await this.connection.query(query);
      
      return {
        success: true,
        data: {
          totalCount: result.totalSize,
          records: result.records,
          policyTypes: [...new Set(result.records.map((r: any) => r.PolicyType))],
          summary: {
            inForcePolicies: result.records.filter((r: any) => r.Status === 'In Force').length,
            pendingPolicies: result.records.filter((r: any) => r.Status === 'Pending').length,
            suspendedPolicies: result.records.filter((r: any) => r.Status === 'Suspended').length,
            averagePremium: result.records.reduce((sum: number, r: any) => sum + (r.TotalPremiumAmount || 0), 0) / result.records.length
          }
        }
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to retrieve existing policies: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get policy with all related records
   */
  async getPolicyWithDetails(policyId: string): Promise<any> {
    try {
      // Get main policy record
      const policy = await this.connection.query(`
        SELECT Id, Name, PolicyType, Status, TotalPremiumAmount, 
               PremiumFrequency, PremiumCalculationMethod,
               TermStartDate, TermEndDate, TermType, RenewalChannel,
               NameInsuredId, NameInsured.Name, ProductId, Product.Name,
               CreatedDate, LastModifiedDate
        FROM ${this.INSURANCE_POLICY_OBJECT}
        WHERE Id = '${policyId}'
      `);

      if (!policy.records || policy.records.length === 0) {
        throw new Error(`Policy with ID ${policyId} not found`);
      }

      const policyRecord = policy.records[0];

      // Get coverage records
      const coverages = await this.connection.query(`
        SELECT Id, Name, CoverageType, CoverageAmount, DeductibleAmount,
               Premium, IsOptionalCoverage, CoverageDescription,
               EffectiveDate, ExpirationDate
        FROM ${this.INSURANCE_POLICY_COVERAGE_OBJECT}
        WHERE InsurancePolicyId = '${policyId}'
      `);

      // Get participant records
      const participants = await this.connection.query(`
        SELECT Id, PrimaryParticipantContactId, PrimaryParticipantContact.Name,
               Role, RelationshipToInsured, IsActiveParticipant
        FROM ${this.INSURANCE_POLICY_PARTICIPANT_OBJECT}
        WHERE InsurancePolicyId = '${policyId}'
      `);

      return {
        success: true,
        data: {
          policy: policyRecord,
          coverages: coverages.records || [],
          participants: participants.records || [],
          summary: {
            totalCoverages: coverages.totalSize || 0,
            totalParticipants: participants.totalSize || 0,
            totalCoverageAmount: (coverages.records || []).reduce((sum: number, c: any) => sum + (c.CoverageAmount || 0), 0),
            totalPremiumFromCoverages: (coverages.records || []).reduce((sum: number, c: any) => sum + (c.Premium || 0), 0)
          }
        }
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to retrieve policy details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Export the tool function for MCP server integration
export async function handleInsurancePolicyDesign(
  connection: any,
  args: any
): Promise<any> {
  const tool = new InsurancePolicyDesignTool(connection);
  
  switch (args.operation) {
    case 'design':
      return await tool.designInsurancePolicyEntity(args.request);
    
    case 'list':
      return await tool.getExistingPolicies(args.policyType, args.limit);
    
    case 'details':
      return await tool.getPolicyWithDetails(args.policyId);
    
    default:
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unsupported operation: ${args.operation}`
      );
  }
}