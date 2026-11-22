import { Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { ToolPage } from './pages/ToolPage';
import { LibraryPage } from './pages/LibraryPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { NotFound } from './pages/NotFound';

/**
 * Routes.
 *
 * `/` and `/app` are public: the demo has to work before anyone signs up, or
 * the claim that it runs on your device is not one a visitor can check.
 * `/library` requires a session, because that is where documents are attached
 * to a person.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<ToolPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
