# Shenage browser E2E

`npm run test:e2e` builds the application in `REACT_APP_DATA_MODE=demo` and serves the
static build locally. This avoids browser-specific CRA development-server lifecycle issues.
Each Playwright context has isolated browser storage, and the configuration rejects
`shenage.ge` as an `E2E_BASE_URL`. The suite must never use production user data.

Use `npm run test:e2e:all` after installing the browser binaries with
`npm run test:e2e:install-browsers` to include Chromium, Firefox, and WebKit.

To test real API behaviour, deploy a dedicated Supabase test project and point
`E2E_BASE_URL` at that isolated deployment. Run `npm run test:e2e:api` only with
the test-only variables listed in `supabase/e2e/README.md`. Store disposable
account credentials and the test project's service-role key only in the CI secret
store, never in this repository. The API runner rejects the production project
reference and production domain.
