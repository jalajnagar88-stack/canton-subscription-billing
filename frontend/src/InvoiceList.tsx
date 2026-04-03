import React, { useState, useEffect } from 'react';
import { cantonJsonApiUrl, httpHeaders } from './config'; // Assuming a config file for API details

/**
 * NOTE: For this component to work, you'll need a corresponding CSS file.
 * Create a file named `InvoiceList.css` in the same directory (`src/`)
 * with styles for `.invoice-list-container`, `.invoice-table`, `.status-paid`, etc.
 */
import './InvoiceList.css';

// TypeScript type that mirrors the Daml `Invoice` template payload.
type InvoicePayload = {
  invoiceId: string;
  provider: string;
  subscriber: string;
  amount: string; // Daml's Decimal type is represented as a string in JSON
  currency: string;
  dueDate: string; // Daml's Date type is 'YYYY-MM-DD'
  status: 'Pending' | 'Paid' | 'Overdue' | 'Forgiven';
};

// Represents an active contract on the ledger from the JSON API response.
type InvoiceContract = {
  contractId: string;
  payload: InvoicePayload;
};

// Props for the InvoiceList component
interface InvoiceListProps {
  party: string;
  token: string;
}

/**
 * A React component that fetches and displays a list of invoices for a given party.
 * It queries the Canton JSON API for `Billing:Invoice` contracts.
 */
const InvoiceList: React.FC<InvoiceListProps> = ({ party, token }) => {
  const [invoices, setInvoices] = useState<InvoiceContract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!party || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${cantonJsonApiUrl}/v1/query`, {
          method: 'POST',
          headers: httpHeaders(token),
          body: JSON.stringify({
            templateIds: ['Billing:Invoice'], // Assuming module name is 'Billing'
            query: { subscriber: party },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch invoices: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        setInvoices(data.result || []);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
        console.error("Error fetching invoices:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [party, token]);

  const getStatusClassName = (status: InvoicePayload['status']) => {
    return `status-${status.toLowerCase()}`;
  };

  const formatCurrency = (amount: string, currency: string) => {
    const numberAmount = parseFloat(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numberAmount);
  };

  if (loading) {
    return <div className="invoice-list-container loading">Loading invoices...</div>;
  }

  if (error) {
    return <div className="invoice-list-container error">Error: {error}</div>;
  }

  if (invoices.length === 0) {
    return <div className="invoice-list-container empty">No invoices found.</div>;
  }

  return (
    <div className="invoice-list-container">
      <h2>Invoice History</h2>
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Provider</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(({ contractId, payload }) => (
            <tr key={contractId}>
              <td>{payload.invoiceId}</td>
              <td>{formatCurrency(payload.amount, payload.currency)}</td>
              <td>{payload.dueDate}</td>
              <td>
                <span className={`status-badge ${getStatusClassName(payload.status)}`}>
                  {payload.status}
                </span>
              </td>
              <td>{payload.provider}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceList;