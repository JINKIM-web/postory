import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "./components/AppShell";
import { Spinner, ToastProvider } from "./components/ui";
import { HomePage, NewProjectRedirect } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { ProcessingPage } from "./pages/ProcessingPage";
import { QuestionsPage } from "./pages/QuestionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { VoicePage } from "./pages/VoicePage";
import "./index.css";

// 편집기(TipTap)는 결과 화면에서만 필요하므로 따로 불러온다
const EditorPage = lazy(() => import("./pages/editor/EditorPage").then((m) => ({ default: m.EditorPage })));

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/new", element: <NewProjectRedirect /> },
      { path: "/library", element: <LibraryPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/voice", element: <VoicePage /> },
      { path: "/projects/:id/setup", element: <SetupPage /> },
      { path: "/projects/:id/processing", element: <ProcessingPage /> },
      { path: "/projects/:id/questions", element: <QuestionsPage /> },
      { path: "/projects/:id/editor", element: (
          <Suspense fallback={<Spinner className="mx-auto mt-20" />}>
            <EditorPage />
          </Suspense>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
