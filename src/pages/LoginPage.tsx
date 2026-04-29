import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services";

import "./LoginPage.css";

const getErrorMessage = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response!.data!.message!;
  }

  return "Failed to connect to server. Please check your connection.";
};

const BrandMarkIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <path
      d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m2.1 21.8 6.4-6.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m19 5-7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M5.5 18.5c0-2.8 2.7-5 6.5-5s6.5 2.2 6.5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <rect x="6.5" y="10.5" width="11" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M9 10.5V8.8c0-1.8 1.4-3.3 3.2-3.3h0c1.8 0 3.2 1.5 3.2 3.3v1.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none">
    <path
      d="M2 12c2.2-4 5.4-6 10-6s7.8 2 10 6c-2.2 4-5.4 6-10 6s-7.8-2-10-6z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none">
    <path
      d="M3 4l18 16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.6 6.2c.5-.1.9-.2 1.4-.2 4.6 0 7.8 2 10 6-.8 1.5-1.8 2.7-2.9 3.6M7.2 8.1C5.1 9 3.4 10.3 2 12c2.2 4 5.4 6 10 6 1.6 0 3.1-.3 4.5-.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 15a3 3 0 0 1-3-3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authService.login(username, password);

      if (response.success) {
        navigate("/admin");
      } else {
        setError(response.message || "Login failed");
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loading) {
      handleLogin();
    }
  };

  return (
    <div className="bg">
      <div className="login-shell">
        <div className="brand-stack">
          <div className="brand-icon" aria-hidden="true">
            <BrandMarkIcon />
          </div>
          <p className="brand-label">Restaurant POS</p>
          <h1 className="brand-title">La Tia Fanny</h1>
        </div>

        <div className="login-card">
          <div className="card-top">
            <p className="card-label">Secure Staff Access</p>
            <h2>Welcome back</h2>
          </div>

          <form className="body login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="error-message" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-shell username-shell">
                <span className="input-icon" aria-hidden="true">
                  <UserIcon />
                </span>
                <input
                  className="field-input"
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper input-shell password-shell">
                <span className="input-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  className="field-input"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div className="footer">
            <div>La Tia Fanny Restaurant Management System {"\u2022"} POS Version 3.2.1</div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
