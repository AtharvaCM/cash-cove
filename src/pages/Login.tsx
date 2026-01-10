import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../app/hooks";
import { setStatus } from "../features/auth/authSlice";
import { supabase } from "../lib/supabaseClient";

export const Login = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const passwordAutoComplete =
    mode === "signin" ? "current-password" : "new-password";
  const passwordMinLength = mode === "signup" ? 8 : undefined;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    dispatch(setStatus("loading"));

    const action =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error: authError } = await action;

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/");
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <Stack gap="xs">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Welcome to
          </Text>
          <Title order={1}>Sanchay</Title>
          <Text size="sm" c="dimmed">
            A focused cockpit for monthly budgets, expenses, and milestones.
          </Text>
        </Stack>
        <form onSubmit={handleSubmit} autoComplete="on">
          <Stack gap="sm">
            <TextInput
              id="email"
              name="email"
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(error)}
              required
            />
            <PasswordInput
              id="password"
              name="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === "signup" ? "Minimum 8 characters" : "Your password"
              }
              autoComplete={passwordAutoComplete}
              minLength={passwordMinLength}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "auth-error" : undefined}
              required
            />
            {error ? (
              <Alert color="red" variant="light" id="auth-error" role="alert">
                {error}
              </Alert>
            ) : null}
            <Button type="submit" loading={loading} fullWidth>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </Stack>
        </form>
        <Button
          type="button"
          variant="subtle"
          color="blue"
          onClick={() =>
            setMode((current) => (current === "signin" ? "signup" : "signin"))
          }
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </Button>
      </div>
      <div className="auth-visual">
        <div className="auth-glow" />
        <div className="auth-metrics">
          <div>
            <span>Monthly clarity</span>
            <strong>Budget vs Spend</strong>
          </div>
          <div>
            <span>Fund tracking</span>
            <strong>Emergency + Goals</strong>
          </div>
          <div>
            <span>Personal notes</span>
            <strong>Keep details handy</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
