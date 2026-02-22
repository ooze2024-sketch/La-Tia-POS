import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/admin");
  };

  return (
    <div className="bg">
      <div className="login-card">

        <div className="header">
          <h1>La Tia Fanny</h1>
          <p>Point of Sale System</p>
        </div>

        <div className="body">
          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />

          <button className="login-btn" onClick={handleLogin}>Log In</button>
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
