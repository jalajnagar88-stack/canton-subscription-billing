import React from 'react';

/**
 * Type definitions mirroring the Daml contract payloads.
 * In a real application, these might be auto-generated or live in a shared types file.
 */
type Party = string;
type DamlDate = string; // ISO 8601 format: "YYYY-MM-DD"

interface BaseSubscriptionPayload {
  provider: Party;
  subscriber: Party;
  planName: string;
  amount: string; // Using string to handle decimal precision correctly
  currency: string;
}

interface ActivePayload extends BaseSubscriptionPayload {
  nextChargeDate: DamlDate;
}

interface GracePeriodPayload extends BaseSubscriptionPayload {
  paymentDueDate: DamlDate;
  gracePeriodEndDate: DamlDate;
}

interface SuspendedPayload extends BaseSubscriptionPayload {
  suspensionDate: DamlDate;
}

/**
 * Represents a generic Daml contract object fetched from the JSON API.
 */
export interface DamlContract<T = any> {
  contractId: string;
  templateId: string;
  payload: T;
}

/**
 * Props for the SubscriptionCard component.
 * It accepts a contract and optional handlers for user actions.
 */
interface SubscriptionCardProps {
  contract: DamlContract<BaseSubscriptionPayload>;
  onPay?: (contractId: string) => Promise<void>;
  onCancel?: (contractId: string) => Promise<void>;
  onReinstate?: (contractId: string) => Promise<void>;
}

/**
 * A simple utility to format a DamlDate string for display.
 */
const formatDate = (isoDate: DamlDate): string => {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * CSS classes for different status badges.
 */
const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  'Subscription:Active': { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  'Subscription:InGracePeriod': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Payment Due' },
  'Subscription:Suspended': { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspended' },
  'default': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' },
};


/**
 * SubscriptionCard component displays the state of a single subscription contract
 * and provides relevant action buttons.
 */
const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ contract, onPay, onCancel, onReinstate }) => {
  // Extract the short template name (e.g., "Subscription:Active") from the full template ID
  const templateName = contract.templateId.split(':').slice(1).join(':');
  const { payload } = contract;
  const style = statusStyles[templateName] || statusStyles.default;

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleAction = async (actionFn?: (cid: string) => Promise<void>) => {
    if (!actionFn) return;
    setIsSubmitting(true);
    try {
      await actionFn(contract.contractId);
    } catch (error) {
      console.error("Failed to exercise choice:", error);
      // Here you might show an error toast to the user
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCardContent = () => {
    switch (templateName) {
      case 'Subscription:Active':
        const activePayload = payload as ActivePayload;
        return (
          <>
            <p className="text-gray-600">
              Next charge of <strong>{activePayload.amount} {activePayload.currency}</strong> on{' '}
              <strong>{formatDate(activePayload.nextChargeDate)}</strong>.
            </p>
            <div className="mt-4">
              <button
                onClick={() => handleAction(onCancel)}
                disabled={isSubmitting || !onCancel}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50"
              >
                {isSubmitting ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            </div>
          </>
        );

      case 'Subscription:InGracePeriod':
        const gracePayload = payload as GracePeriodPayload;
        return (
          <>
            <p className="text-yellow-800">
              Payment of <strong>{gracePayload.amount} {gracePayload.currency}</strong> was due on{' '}
              <strong>{formatDate(gracePayload.paymentDueDate)}</strong>.
            </p>
            <p className="mt-1 text-gray-600">
              Please pay by <strong>{formatDate(gracePayload.gracePeriodEndDate)}</strong> to avoid service suspension.
            </p>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => handleAction(onPay)}
                disabled={isSubmitting || !onPay}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Pay Now'}
              </button>
              <button
                onClick={() => handleAction(onCancel)}
                disabled={isSubmitting || !onCancel}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        );

      case 'Subscription:Suspended':
        const suspendedPayload = payload as SuspendedPayload;
        return (
          <>
            <p className="text-red-800">
              Service was suspended on <strong>{formatDate(suspendedPayload.suspensionDate)}</strong> due to non-payment.
            </p>
            <p className="mt-1 text-gray-600">
              Outstanding balance: <strong>{suspendedPayload.amount} {suspendedPayload.currency}</strong>.
            </p>
            <div className="mt-4">
              <button
                onClick={() => handleAction(onReinstate)}
                disabled={isSubmitting || !onReinstate}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Pay and Reinstate'}
              </button>
            </div>
          </>
        );

      default:
        return <p className="text-gray-500">Subscription status is unrecognized.</p>;
    }
  };

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
      <header className="flex items-center justify-between pb-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">{payload.planName}</h2>
        <span
          className={`px-3 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
      </header>
      <div className="pt-4">
        {renderCardContent()}
      </div>
    </div>
  );
};

export default SubscriptionCard;