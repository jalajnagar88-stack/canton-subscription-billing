import React, { useState, useEffect, useCallback } from 'react';
import { fetchSubscriptions, fetchServiceContracts, cancelSubscription, suspendService } from './billingService';
import { SubscriptionCard } from './SubscriptionCard';
import './App.css';

// These types would typically be auto-generated or in a shared types file
// based on the Daml model's JSON API representation.
export interface Subscription {
  contractId: string;
  payload: {
    merchant: string;
    subscriber: string;
    productId: string;
    amount: string;
    currency: string;
    period: string;
    nextDueDate: string;
    lastPayment: string | null;
    failedPayments: string;
  };
}

export interface ServiceContract {
  contractId: string;
  payload: {
    provider: string;
    user: string;
    productId: string;
    status: { tag: "Active" | "Suspended" | "Terminated", value: {} };
    subscriptionCid: string;
  };
}

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('daml_token'));
  const [party, setParty] = useState<string | null>(localStorage.getItem('daml_party'));
  const [partyInput, setPartyInput] = useState('');

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [serviceContracts, setServiceContracts] = useState<ServiceContract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (partyInput) {
      // In a real app, you'd fetch a token from an auth service.
      // Here, we'll use a placeholder token structure, assuming the party name is the sub.
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = {
        "https://daml.com/ledger-api": {
          ledgerId: "canton-subscription-billing-ledger",
          applicationId: "canton-subscription-billing",
          actAs: [partyInput],
        },
      };
      const dummyToken = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.`;
      
      setParty(partyInput);
      setToken(dummyToken);
      localStorage.setItem('daml_party', partyInput);
      localStorage.setItem('daml_token', dummyToken);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setParty(null);
    setSubscriptions([]);
    setServiceContracts([]);
    localStorage.removeItem('daml_token');
    localStorage.removeItem('daml_party');
  };

  const fetchData = useCallback(async () => {
    if (!token || !party) return;

    setIsLoading(true);
    setError(null);
    try {
      const [subs, services] = await Promise.all([
        fetchSubscriptions(token),
        fetchServiceContracts(token),
      ]);
      setSubscriptions(subs);
      setServiceContracts(services);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [token, party]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: () => Promise<any>) => {
    setIsLoading(true);
    try {
      await action();
      await fetchData(); // Refresh data after action
    } catch (err: any) {
      console.error("Action failed:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancelSubscription = (contractId: string) => {
    if (!token || !party) return;
    handleAction(() => cancelSubscription(token, party, contractId));
  };

  const handleSuspendService = (contractId: string) => {
    if (!token || !party) return;
    handleAction(() => suspendService(token, party, contractId));
  };


  if (!token || !party) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Canton Subscription Billing</h2>
          <form onSubmit={handleLogin}>
            <p>Enter your Party ID to log in.</p>
            <input
              type="text"
              placeholder="e.g., Merchant, Alice, Bob"
              value={partyInput}
              onChange={(e) => setPartyInput(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!partyInput}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  // Filter contracts for the logged-in party
  const mySubscribedServices = subscriptions.filter(s => s.payload.subscriber === party);
  const myManagedSubscriptions = subscriptions.filter(s => s.payload.merchant === party);
  const myActiveServices = serviceContracts.filter(s => s.payload.user === party && s.payload.status.tag === "Active");
  const mySuspendedServices = serviceContracts.filter(s => s.payload.user === party && s.payload.status.tag === "Suspended");

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Billing Dashboard</h1>
        <div className="user-info">
          <span>Logged in as: <strong>{party}</strong></span>
          <button onClick={handleLogout}>Logout</button>
          <button onClick={fetchData} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="dashboard">
        <section className="dashboard-section">
          <h2>My Subscriptions (as Subscriber)</h2>
          <div className="card-grid">
            {mySubscribedServices.length > 0 ? (
              mySubscribedServices.map(sub => (
                <SubscriptionCard
                  key={sub.contractId}
                  subscription={sub}
                  party={party}
                  onCancel={() => handleCancelSubscription(sub.contractId)}
                />
              ))
            ) : (
              <p>You have not subscribed to any services.</p>
            )}
          </div>
        </section>

        <section className="dashboard-section">
          <h2>My Active Services</h2>
          <div className="card-grid">
            {myActiveServices.length > 0 ? (
               myActiveServices.map(service => (
                <div key={service.contractId} className="service-card active">
                  <h3>Product: {service.payload.productId}</h3>
                  <p>Provider: {service.payload.provider}</p>
                  <p>Status: <strong>{service.payload.status.tag}</strong></p>
                  <small>Contract ID: {service.contractId}</small>
                </div>
              ))
            ) : (
              <p>You have no active services.</p>
            )}
          </div>
        </section>
        
        <section className="dashboard-section">
          <h2>My Suspended Services</h2>
          <div className="card-grid">
            {mySuspendedServices.length > 0 ? (
               mySuspendedServices.map(service => (
                <div key={service.contractId} className="service-card suspended">
                  <h3>Product: {service.payload.productId}</h3>
                  <p>Provider: {service.payload.provider}</p>
                  <p>Status: <strong>{service.payload.status.tag}</strong></p>
                  <small>Contract ID: {service.contractId}</small>
                </div>
              ))
            ) : (
              <p>You have no suspended services.</p>
            )}
          </div>
        </section>


        <section className="dashboard-section">
          <h2>Managed Subscriptions (as Merchant)</h2>
           <div className="card-grid">
            {myManagedSubscriptions.length > 0 ? (
              myManagedSubscriptions.map(sub => (
                <SubscriptionCard
                  key={sub.contractId}
                  subscription={sub}
                  party={party}
                  onSuspend={() => {
                      const service = serviceContracts.find(s => s.payload.subscriptionCid === sub.contractId);
                      if(service) handleSuspendService(service.contractId);
                  }}
                />
              ))
            ) : (
              <p>You are not managing any subscriptions.</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

export default App;