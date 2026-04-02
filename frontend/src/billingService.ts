/**
 * @file Service layer for interacting with the Daml ledger via the JSON API
 * for subscription and billing operations.
 */

// --- JSON API Command and Query Types ---

/**
 * Represents a command to create a new Daml contract.
 * @template T The payload type of the contract.
 */
export interface CreateCommand<T> {
  templateId: string;
  payload: T;
}

/**
 * Represents a command to exercise a choice on an existing Daml contract.
 * @template T The argument type of the choice.
 */
export interface ExerciseCommand<T> {
  templateId: string;
  contractId: string;
  choice: string;
  argument: T;
}

/**
 * Represents a query to fetch active Daml contracts.
 */
export interface Query {
  templateIds: string[];
  query?: any;
}

// --- Daml Template Payload Interfaces ---
// These should mirror the data types defined in the Daml templates.

/**
 * Payload for the `PaymentAuthorisation` template.
 */
export interface PaymentAuthorisation {
  subscriber: string; // Party
  biller: string; // Party
  amount: string; // Decimal
  currency: string;
  billingCycleDays: number; // Int
  lastPaymentDate: string; // Date (YYYY-MM-DD)
  nextPaymentDate: string; // Date (YYYY-MM-DD)
  // Assuming an optional field for suspension
  suspendedFrom?: string; // Optional Time
}

/**
 * Payload for the `GracePeriod` template.
 */
export interface GracePeriod {
  subscriber: string; // Party
  biller: string; // Party
  missedAmount: string; // Decimal
  dueDate: string; // Date
  originalAuthCid: string; // ContractId PaymentAuthorisation
}


// --- API Response Types ---

/**
 * Represents a contract returned from the JSON API.
 * @template T The payload type of the contract.
 */
export interface Contract<T> {
  contractId: string;
  templateId: string;
  payload: T;
  signatories: string[];
  observers: string[];
  agreementText: string;
}

/**
 * Represents a successful API response from a command (create/exercise).
 */
export interface CommandResponse<T> {
  contractId: string;
  payload: T;
  // ... other metadata from exercise results
}


// --- Service Configuration ---

const LEDGER_URL = process.env.REACT_APP_LEDGER_URL || 'http://localhost:7575';
// NOTE: This package ID must match the 'name' and 'version' in your daml.yaml
const PACKAGE_ID = 'canton-subscription-billing-0.1.0';

const TEMPLATE_IDS = {
  PaymentAuthorisation: `${PACKAGE_ID}:PaymentAuthorisation:PaymentAuthorisation`,
  GracePeriod: `${PACKAGE_ID}:GracePeriod:GracePeriod`,
};


// --- Private Helper for API Calls ---

/**
 * Generic POST request handler for the JSON API.
 * @param token The JWT token for authorization.
 * @param endpoint The API endpoint (e.g., '/v1/create').
 * @param body The request body.
 * @returns The `result` field from the JSON API response.
 */
const post = async <T>(token: string, endpoint: string, body: object): Promise<T> => {
  try {
    const response = await fetch(`${LEDGER_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
    });

    const jsonResponse = await response.json();

    if (!response.ok || jsonResponse.status !== 200) {
      const errorMessage = jsonResponse.errors?.join(', ') || `Request failed with status ${response.status}`;
      console.error("API Error:", errorMessage, jsonResponse);
      throw new Error(errorMessage);
    }

    return jsonResponse.result as T;
  } catch (error) {
    console.error(`Failed to execute POST request to ${endpoint}:`, error);
    throw error;
  }
};


// --- Public Service Functions ---

/**
 * Creates a new PaymentAuthorisation contract on the ledger.
 * This action is performed by the subscriber, authorizing the biller.
 * @param token The subscriber's JWT token.
 * @param subscriberPartyId The party ID of the subscriber.
 * @param args The details of the subscription.
 * @returns The created PaymentAuthorisation contract.
 */
export const createSubscription = (
  token: string,
  subscriberPartyId: string,
  args: {
    biller: string;
    amount: string;
    currency: string;
    billingCycleDays: number;
    startDate: string; // YYYY-MM-DD
  }
) => {
  const command: CreateCommand<Omit<PaymentAuthorisation, 'nextPaymentDate'>> = {
    templateId: TEMPLATE_IDS.PaymentAuthorisation,
    payload: {
      subscriber: subscriberPartyId,
      biller: args.biller,
      amount: args.amount,
      currency: args.currency,
      billingCycleDays: args.billingCycleDays,
      lastPaymentDate: args.startDate,
      // nextPaymentDate is calculated by the template's `preconsuming` block
    },
  };

  return post<CommandResponse<PaymentAuthorisation>>(token, '/v1/create', command);
};


/**
 * Fetches all active PaymentAuthorisation contracts for a given party.
 * @param token The party's JWT token.
 * @returns An array of active subscription contracts.
 */
export const getActiveSubscriptions = (token: string): Promise<Contract<PaymentAuthorisation>[]> => {
  const query: Query = {
    templateIds: [TEMPLATE_IDS.PaymentAuthorisation],
  };
  return post<Contract<PaymentAuthorisation>[]>(token, '/v1/query', query);
};


/**
 * Fetches all subscriptions in a grace period for a given party.
 * @param token The party's JWT token.
 * @returns An array of grace period contracts.
 */
export const getGracePeriodSubscriptions = (token: string): Promise<Contract<GracePeriod>[]> => {
  const query: Query = {
    templateIds: [TEMPLATE_IDS.GracePeriod],
  };
  return post<Contract<GracePeriod>[]>(token, '/v1/query', query);
};


/**
 * Exercises the 'Cancel' choice on a PaymentAuthorisation contract.
 * This can only be called by the subscriber.
 * @param token The subscriber's JWT token.
 * @param contractId The contract ID of the PaymentAuthorisation to cancel.
 * @returns The result of the exercise command.
 */
export const cancelSubscription = (token: string, contractId: string) => {
  const command: ExerciseCommand<{}> = {
    templateId: TEMPLATE_IDS.PaymentAuthorisation,
    contractId: contractId,
    choice: 'Cancel',
    argument: {},
  };
  return post(token, '/v1/exercise', command);
};


/**
 * Exercises the 'MakePayment' choice on a GracePeriod contract to resolve an outstanding debt.
 * This is typically called by the subscriber.
 * @param token The subscriber's JWT token.
 * @param contractId The contract ID of the GracePeriod contract.
 * @param paymentAmount The amount being paid, which should match the missed amount.
 * @returns The result of the exercise command, which may include new contracts.
 */
export const resolveGracePeriod = (token: string, contractId: string, paymentAmount: string) => {
  const command: ExerciseCommand<{ paymentAmount: string }> = {
    templateId: TEMPLATE_IDS.GracePeriod,
    contractId: contractId,
    choice: 'MakePayment',
    argument: {
      paymentAmount,
    },
  };
  return post(token, '/v1/exercise', command);
};