import { useState } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl font-medium text-ink mb-2 italic">Lists</h1>
          <p className="text-sm text-muted">Simple lists that sync across your devices.</p>
        </div>
        {sent ? (
          <div className="bg-surface rounded-2xl p-6 border border-warm">
            <h2 className="font-display text-xl font-medium text-ink mb-2">Check your email</h2>
            <p className="text-sm text-muted leading-relaxed">
              We sent a sign-in link to <span className="text-ink font-medium">{email}</span>. Click it to continue.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="mt-4 text-xs text-faint hover:text-ink transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="bg-surface rounded-2xl p-6 border border-warm space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="mt-1.5 w-full bg-app border border-warm rounded-lg px-3 py-2.5 text-ink text-[15px] focus:border-warmer transition-colors"
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-ink text-active py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Sending...' : 'Send sign-in link'}
            </button>
            <p className="text-xs text-faint text-center leading-relaxed pt-1">
              No password needed. We will email you a one-time sign-in link.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
