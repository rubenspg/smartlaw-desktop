import { useEffect } from 'react';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './components/theme-provider';
import { RegionalProvider } from './components/regional-provider';
import { ToastProvider } from './components/ui/toast';
import { ConfirmDialogProvider } from './components/ui/confirm-dialog';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

// Create a new query client
const queryClient = new QueryClient();

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // We'll inject this via a component wrapper
  },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const auth = useAuth();

  console.log('InnerApp rendering, auth state:', { isLoading: auth.isLoading, isAuthenticated: auth.isAuthenticated });

  // Re-validate the router when auth state changes
  useEffect(() => {
    router.invalidate();
  }, [auth.isAuthenticated, auth.isLoading]);
  return <RouterProvider router={router} context={{ auth }} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="smartlaw_theme">
        <RegionalProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <AuthProvider>
                <InnerApp />
              </AuthProvider>
            </ConfirmDialogProvider>
          </ToastProvider>
        </RegionalProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
