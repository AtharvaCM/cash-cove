import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { setSession, setStatus } from "./features/auth/authSlice";
import { seedDefaults } from "./lib/seedDefaults";
import { supabase } from "./lib/supabaseClient";
import { Budgets } from "./pages/Budgets";
import { Cashflow } from "./pages/Cashflow";
import { Dashboard } from "./pages/Dashboard";
import { Funds } from "./pages/Funds";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";
import { Transactions } from "./pages/Transactions";
import { Subscriptions } from "./pages/Subscriptions";
import { Reports } from "./pages/Reports";
import { AppMonthProvider } from "./context/AppMonthContext";

const App = () => {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.status);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);

  useEffect(() => {
    dispatch(setStatus("loading"));

    supabase.auth
      .getSession()
      .then(({ data }) => {
        dispatch(setSession(data.session));
      })
      .catch(() => {
        dispatch(setSession(null));
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        dispatch(setSession(session));
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    if (authStatus === "authed" && userId) {
      seedDefaults();
    }
  }, [authStatus, userId]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppMonthProvider>
              <AppLayout />
            </AppMonthProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="cashflow" element={<Cashflow />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="reports" element={<Reports />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="funds" element={<Funds />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
