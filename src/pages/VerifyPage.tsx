import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useStore from '../store/store';
import { validatePasswordComplexity } from '../utils/password';
import { extractErrorMessage } from '../utils/api';
import type { AuthToken } from '../types/auth';

type Status = 'checking' | 'valid' | 'invalid';

interface VerifiedUserInfo {
  user_id: string;
  user_email: string;
  user_first_name: string;
}

interface VerifyPageProps {
  onVerified: (token: AuthToken) => void;
}

function VerifyPage({ onVerified }: VerifyPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const { checkVerificationToken, verifyMember } = useStore();

  const [status, setStatus] = useState<Status>(() => (token ? 'checking' : 'invalid'));
  const [checkError, setCheckError] = useState(() =>
    token ? '' : 'This verification link is missing a token.'
  );
  const [userInfo, setUserInfo] = useState<VerifiedUserInfo | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await checkVerificationToken(token);
        if (cancelled) return;
        setUserInfo(data);
        setStatus('valid');
      } catch (err) {
        if (cancelled) return;
        setCheckError(extractErrorMessage(err, 'Invalid or expired verification link.'));
        setStatus('invalid');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userInfo) return;

    const complexityError = validatePasswordComplexity(password);
    if (complexityError) {
      setSubmitError(complexityError);
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);
    try {
      const authToken = await verifyMember({ user_id: userInfo.user_id, otp_token: token, password });
      // Verification returns a session the same way login does, so we can
      // go straight into the app instead of sending the user through login.
      onVerified(authToken);
      navigate('/upload', { replace: true });
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Something went wrong.'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-logo" title="Vianalytics">
            <svg className="icon-logo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="brand-title">Vianalytics</span>
        </div>

        {status === 'checking' && (
          <>
            <h1 className="login-title">Checking your link…</h1>
            <p className="login-subtitle">Please wait a moment.</p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="login-title">Invalid link</h1>
            <p className="login-error">{checkError}</p>
            <Link to="/login" className="btn btn-secondary login-submit">
              Back to sign in
            </Link>
          </>
        )}

        {status === 'valid' && userInfo && (
          <>
            <h1 className="login-title">Set your password</h1>
            <p className="login-subtitle">
              Welcome, {userInfo.user_first_name}. Choose a password for {userInfo.user_email}.
            </p>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="login-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {submitError && <p className="login-error">{submitError}</p>}

              <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Setting password…' : 'Set Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyPage;
