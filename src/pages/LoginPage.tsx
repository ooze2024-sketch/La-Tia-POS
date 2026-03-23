import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services";
import "./LoginPage.css";

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
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to connect to server. Please check your connection.";
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="bg">
      <div className="login-card">
        {/* Header with brand and subtitle */}
        <div className="header">
          <h1>La Tia Fanny</h1>
          <p>Point of Sale System</p>
        </div>

        {/* Login form body */}
        <div className="body">
          {error && <div className="error-message">{error}</div>}

          {/* Username field */}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          {/* Password field with visibility toggle */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁" : "⌣"}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button 
            className="login-btn" 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </div>

        {/* Footer */}
        <div className="footer">
          La Tia Fanny Restaurant Management System • POS Version 3.2.1
          <br/>
          © 2026
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
