import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SiteShell } from '#/components/site-shell'

// The public pages: rendered on the server, no local database, header and footer around them.
export const Route = createFileRoute('/_site')({
  component: () => (
    <SiteShell>
      <Outlet />
    </SiteShell>
  ),
})
