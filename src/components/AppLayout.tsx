import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  NavLink as MantineNavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import {
  LayoutGrid,
  TrendingUp,
  List,
  Wallet,
  PiggyBank,
  Repeat,
  BarChart3,
  Settings as SettingsIcon,
  RefreshCcw,
  LogOutIcon,
  ChevronsRight,
  ChevronsLeft,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  NavLink as RouterNavLink,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { apiSlice } from "../features/api/apiSlice";
import { clearAuth } from "../features/auth/authSlice";
import { supabase } from "../lib/supabaseClient";
import { QuickAddDrawer } from "./quickAdd/QuickAddDrawer";
import { useAppMonth } from "../context/AppMonthContext";

export const AppLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem("cashcove:sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [isSidebarHovering, setIsSidebarHovering] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const { month, setMonth } = useAppMonth();
  const isNavExpanded = useMemo(
    () => isMobile || !isCollapsed || isSidebarHovering,
    [isCollapsed, isSidebarHovering, isMobile]
  );
  const sidebarWidth = useMemo(() => {
    if (isMobile) {
      return "100%";
    }
    if (isCollapsed) {
      return isSidebarHovering ? 240 : 76;
    }
    return 260;
  }, [isCollapsed, isSidebarHovering, isMobile]);
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const location = useLocation();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    dispatch(clearAuth());
    dispatch(apiSlice.util.resetApiState());
  };

  const titleMap: Record<string, string> = {
    "/": "Overview",
    "/cashflow": "Cashflow",
    "/transactions": "Transactions",
    "/budgets": "Budgets",
    "/funds": "Funds",
    "/subscriptions": "Subscriptions",
    "/reports": "Reports",
    "/settings": "Settings",
  };

  const title = titleMap[location.pathname] ?? "CashCove";
  const shellClassName = `app-shell${isCollapsed ? " collapsed" : ""}`;
  const shellStyle = {
    gridTemplateColumns: isMobile ? "1fr" : `${sidebarWidth}px 1fr`,
    gridTemplateRows: isMobile ? "auto 1fr" : undefined,
    transition: "grid-template-columns 200ms ease",
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:sidebar",
        isCollapsed ? "collapsed" : "expanded"
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key.toLowerCase() !== "k") {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }
      event.preventDefault();
      setQuickAddOpen(true);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, []);

  const navItems = [
    { to: "/", label: "Overview", icon: <LayoutGrid size={18} /> },
    { to: "/cashflow", label: "Cashflow", icon: <TrendingUp size={18} /> },
    { to: "/transactions", label: "Transactions", icon: <List size={18} /> },
    {
      to: "/subscriptions",
      label: "Subscriptions",
      icon: <Repeat size={18} />,
    },
    { to: "/reports", label: "Reports", icon: <BarChart3 size={18} /> },
    { to: "/budgets", label: "Budgets", icon: <Wallet size={18} /> },
    { to: "/funds", label: "Funds", icon: <PiggyBank size={18} /> },
    { to: "/settings", label: "Settings", icon: <SettingsIcon size={18} /> },
  ];

  const isActiveRoute = (path: string) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  return (
    <div
      className={shellClassName}
      style={shellStyle}
      aria-label="CashCove layout shell"
    >
      <QuickAddDrawer
        opened={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
      <aside
        className="sidebar"
        onMouseEnter={() =>
          !isMobile && isCollapsed && setIsSidebarHovering(true)
        }
        onMouseLeave={() => !isMobile && setIsSidebarHovering(false)}
        style={{ width: "100%", transition: "width 200ms ease" }}
      >
        <div className="sidebar-header">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" align="center" wrap="nowrap">
              <div className="brand-mark">₹</div>
              {isNavExpanded ? (
                <div className="brand-text">
                  <Title order={4}>CashCove</Title>
                </div>
              ) : null}
            </Group>
            {isNavExpanded && !isMobile ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={() => setIsCollapsed((current) => !current)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={isCollapsed}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <ChevronsRight size={18} />
                ) : (
                  <ChevronsLeft size={18} />
                )}
              </ActionIcon>
            ) : null}
          </Group>
        </div>
        <div className="sidebar-body">
          <ScrollArea type="scroll" offsetScrollbars style={{ flex: 1 }}>
            <Stack gap="md">
              <Stack gap="xs">
                {navItems.map((item) => {
                  const isActive = isActiveRoute(item.to);
                  const navLink = (
                    <MantineNavLink
                      component={RouterNavLink}
                      to={item.to}
                      label={item.label}
                      aria-label={item.label}
                      leftSection={
                        <ThemeIcon
                          variant={isActive ? "filled" : "light"}
                          color="brand"
                          radius="md"
                          size={32}
                        >
                          {item.icon}
                        </ThemeIcon>
                      }
                      active={isActive}
                      variant="subtle"
                      styles={{
                        root: {
                          borderRadius: "12px",
                          padding: isNavExpanded ? "8px 10px" : undefined,
                          border:
                            isActive && isNavExpanded
                              ? "1px solid var(--stroke)"
                              : undefined,
                          backgroundColor:
                            isActive && isNavExpanded
                              ? "var(--surface-alt)"
                              : undefined,
                        },
                        body: {
                          justifyContent: isNavExpanded
                            ? "flex-start"
                            : "center",
                        },
                        label: {
                          display: isNavExpanded ? "block" : "none",
                          fontWeight: 600,
                        },
                        section: {
                          marginInlineEnd: isNavExpanded ? 12 : 0,
                        },
                      }}
                    />
                  );

                  return isNavExpanded ? (
                    <div key={item.to}>{navLink}</div>
                  ) : (
                    <Tooltip
                      key={item.to}
                      label={item.label}
                      position="right"
                      withArrow
                    >
                      {navLink}
                    </Tooltip>
                  );
                })}
              </Stack>
            </Stack>
          </ScrollArea>
        </div>
        <div className="sidebar-footer">
          <Stack gap="sm" align={isNavExpanded ? "stretch" : "center"}>
            {isNavExpanded ? (
              <Paper withBorder radius="md" p="sm">
                <Text size="sm" c="dimmed">
                  {user?.email ?? ""}
                </Text>
              </Paper>
            ) : null}
            {isNavExpanded ? (
              <Button
                variant="light"
                color="gray"
                leftSection={
                  <ThemeIcon
                    variant="transparent"
                    color="gray"
                    radius="md"
                    size={28}
                  >
                    <LogOutIcon size={20} />
                  </ThemeIcon>
                }
                onClick={handleSignOut}
                fullWidth
              >
                Sign out
              </Button>
            ) : (
              <Tooltip label="Sign out" position="right" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                >
                  <LogOutIcon size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </Stack>
        </div>
      </aside>
      <main className="main">
        <Paper withBorder radius="lg" p="md" className="topbar-card">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={700}
                style={{ letterSpacing: "0.14em" }}
              >
                Monthly snapshot
              </Text>
              <Group gap="xs">
                <Title order={2}>{title}</Title>
                <Divider orientation="vertical" />
                <Badge variant="light" color="blue">
                  IST · INR
                </Badge>
              </Group>
            </Stack>
            <Group gap="xs" className="topbar-actions" align="flex-end">
              <MonthPickerInput
                label="Month"
                value={dayjs(month + "-01").toDate()}
                onChange={(value) =>
                  value && setMonth(dayjs(value).format("YYYY-MM"))
                }
                maxDate={dayjs().endOf("month").toDate()}
                size="xs"
                clearable={false}
                styles={{ input: { width: 160 } }}
              />
              <Button
                variant="light"
                color="blue"
                size="compact-sm"
                onClick={() => setQuickAddOpen(true)}
                leftSection={<Plus size={16} strokeWidth={2} />}
                style={{ marginBottom: "2px" }}
              >
                Quick add
              </Button>
              <Button
                variant="light"
                color="gray"
                size="compact-sm"
                onClick={() => window.location.reload()}
                leftSection={<RefreshCcw size={16} strokeWidth={2} />}
                style={{ marginBottom: "2px" }}
              >
                Refresh
              </Button>
            </Group>
          </Group>
        </Paper>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
