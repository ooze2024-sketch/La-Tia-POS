import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI, setAuthToken } from "../services/api";
import "./LoginPage.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      const response = await authAPI.login(username, password);

      if (response.success) {
        // Store the token
        setAuthToken(response.data.token);
        // Navigate to admin page
        navigate("/admin");
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="bg">
      <div className="login-card">

        <div className="header">
          <h1>La Tia Fanny</h1>
          <p>Point of Sale System</p>
        </div>

        <div className="body">
          {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}

          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />

          <button 
            className="login-btn" 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </div>

        <div className="footer">
          La Tia Fanny Restaurant Management System
          <br/>
          POS Version 3.2.1 © 2026
        </div>

      </div>
    </div>
  );
}

export default App;
